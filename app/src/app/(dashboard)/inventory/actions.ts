"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { sendPushToUsers } from "@/lib/push";
import { getTierConfig } from "@/lib/notification-tiers";
import { InsufficientStockError, type StockMovementType } from "@/lib/inventory";
import { handleActionError } from "@/lib/error-messages";

export interface InventoryItemInput {
  name: string;
  sku?: string;
  category?: string;
  unit?: string;
  quantity: number;
  minQuantity?: number;
  unitCost?: number;
  location?: string;
  supplier?: string;
  notes?: string;
}

/** Push a low-stock alert only when quantity CROSSES the threshold, not on every save while it stays low. */
async function maybeSendLowStockAlert(
  organizationId: string,
  item: { id: string; name: string; quantity: number; minQuantity: number },
  previousQuantity: number | null
) {
  const crossedIntoLowStock =
    item.quantity <= item.minQuantity && (previousQuantity === null || previousQuantity > item.minQuantity);
  if (!crossedIntoLowStock) return;

  const tierConfig = getTierConfig("low_stock");
  if (!tierConfig.channels.includes("webPush")) return;

  const recipients = await prisma.member.findMany({
    where: { organizationId, role: { in: tierConfig.roles } },
    select: { userId: true },
  });

  await sendPushToUsers(recipients.map((r) => r.userId), {
    title: "Low Stock Alert",
    body: `${item.name} is down to ${item.quantity} (min: ${item.minQuantity})`,
    url: `/inventory/${item.id}`,
    tag: `low-stock-${item.id}`,
  }).catch((err) => console.error("Failed to send low stock alert:", err));
}

/** Where a part went. Exactly one of these, or none for "somewhere else". */
export interface StockDestination {
  truckId?: string | null;
  trailerId?: string | null;
  tripId?: string | null;
  driverId?: string | null;
}

/**
 * Turn stock leaving the storeroom into a cost on the thing that got it.
 *
 * Nothing in the inventory flow created an expense before this — a grep for
 * "expense" across the whole inventory folder matched nothing — so a $20 brake
 * pad fitted to a truck contributed $0 to that truck's costs, to its category
 * breakdown, to its maintenance spend and to every report. The parts left the
 * shelf and the money left the story.
 *
 * ## No account is debited, deliberately
 *
 * The cash went when the parts were *bought*. Debiting an account again when
 * they are *consumed* would count the same money twice — which is why this
 * writes the expense with `isPaid: true` and never calls
 * `debitAccountForExpense`. The client chose this on 12 Oct. Anyone
 * "fixing" it later should read this paragraph first.
 *
 * Quantity and unit are carried onto the expense, so the truck page can show a
 * supervisor "2 brake pads" without showing them a figure — the same fields
 * the fuel-litres work added in September.
 */
async function postStockExpense(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    categoryId: string;
    item: { id: string; name: string; unit: string | null };
    quantity: number;
    unitCost: number;
    date: Date;
    destination: StockDestination;
    reason?: string | null;
  },
) {
  const amount = Math.round(params.unitCost * params.quantity * 100) / 100;

  const expense = await tx.expense.create({
    data: {
      organizationId: params.organizationId,
      categoryId: params.categoryId,
      amount,
      quantity: params.quantity,
      unit: params.item.unit || "units",
      description: `${params.item.name} from stock`,
      notes: params.reason || null,
      date: params.date,
      // The money left when the stock was bought — see the note above.
      isPaid: true,
      paidDate: params.date,
      // One of these, matching the destination, so the existing cost engine
      // (lib/metrics/truck-costs.ts) finds it with the queries it already runs.
      ...(params.destination.truckId
        ? { truckExpenses: { create: { truckId: params.destination.truckId } } }
        : {}),
      ...(params.destination.trailerId
        ? { trailerExpenses: { create: { trailerId: params.destination.trailerId } } }
        : {}),
      ...(params.destination.tripId
        ? { tripExpenses: { create: { tripId: params.destination.tripId } } }
        : {}),
      ...(params.destination.driverId
        ? { driverExpenses: { create: { driverId: params.destination.driverId } } }
        : {}),
    },
  });

  return { expense, amount };
}

/**
 * Undo the cost a movement posted, when that movement is corrected or removed.
 *
 * Deletes the expense rather than writing a negative one: a parts expense has
 * no account entry behind it, so there is nothing to reverse in a ledger, and
 * a storeroom correction should not leave two rows for one tyre. The join rows
 * go with it by cascade.
 */
async function unpostStockExpense(
  tx: Prisma.TransactionClient,
  expenseId: string | null | undefined,
) {
  if (!expenseId) return;
  await tx.expense.deleteMany({ where: { id: expenseId } });
}

async function recordMovement(
  tx: Prisma.TransactionClient,
  data: {
    organizationId: string;
    inventoryItemId: string;
    type: StockMovementType;
    quantity: number;
    quantityBefore: number;
    quantityAfter: number;
    destination?: string;
    reason?: string;
    performedById: string;
    /** Pass explicitly when the caller already knows the cost being applied. */
    unitCost?: number | null;
    /** Where it went, as references rather than the free-text destination. */
    truckId?: string | null;
    trailerId?: string | null;
    tripId?: string | null;
    driverId?: string | null;
    /** The expense this movement posted, so a correction can reverse it. */
    expenseId?: string | null;
  }
) {
  // Stamp the unit cost onto the movement so the money value of a past
  // movement doesn't silently change when the item is repriced later.
  const unitCost =
    data.unitCost !== undefined
      ? data.unitCost
      : (
          await tx.inventoryItem.findUnique({
            where: { id: data.inventoryItemId },
            select: { unitCost: true },
          })
        )?.unitCost ?? null;

  await tx.stockMovement.create({ data: { ...data, unitCost } });
}

/**
 * Atomically removes stock: the conditional updateMany only succeeds if enough
 * stock is still there at write time, so two people taking out the last units
 * at once can't drive quantity negative.
 */
async function decrementStock(
  tx: Prisma.TransactionClient,
  organizationId: string,
  inventoryItemId: string,
  quantity: number
) {
  const item = await tx.inventoryItem.findFirst({ where: { id: inventoryItemId, organizationId } });
  if (!item) throw new Error("Item not found");

  const result = await tx.inventoryItem.updateMany({
    where: { id: inventoryItemId, organizationId, quantity: { gte: quantity } },
    data: { quantity: { decrement: quantity } },
  });
  if (result.count === 0) {
    throw new InsufficientStockError(item.name, item.quantity, quantity, item.unit);
  }

  const updated = await tx.inventoryItem.findUniqueOrThrow({ where: { id: inventoryItemId } });
  return { before: updated.quantity + quantity, updated };
}

function revalidateInventory(itemId?: string) {
  revalidatePath("/inventory");
  if (itemId) revalidatePath(`/inventory/${itemId}`);
}

function validQuantity(quantity: number) {
  return Number.isInteger(quantity) && quantity > 0;
}

export async function createInventoryItem(data: InventoryItemInput) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    if (data.sku) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, organizationId: session.organizationId },
      });
      if (existing) {
        return { success: false as const, error: "An item with this SKU already exists" };
      }
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.inventoryItem.create({
        data: {
          ...data,
          minQuantity: data.minQuantity ?? 5,
          organizationId: session.organizationId,
        },
      });

      if (created.quantity > 0) {
        await recordMovement(tx, {
          organizationId: session.organizationId,
          inventoryItemId: created.id,
          type: "in",
          quantity: created.quantity,
          quantityBefore: 0,
          quantityAfter: created.quantity,
          destination: data.supplier || undefined,
          reason: "Opening stock",
          performedById: session.user.id,
        });
      }

      return created;
    });

    await maybeSendLowStockAlert(session.organizationId, item, null);

    revalidateInventory();
    return { success: true as const, item };
  } catch (error) {
    return handleActionError(error, "Failed to create inventory item");
  }
}

export async function updateInventoryItem(id: string, data: Partial<InventoryItemInput>,
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "inventory_item",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!item) {
      return { success: false as const, error: "Item not found" };
    }

    if (data.sku && data.sku !== item.sku) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, organizationId: session.organizationId, NOT: { id } },
      });
      if (existing) {
        return { success: false as const, error: "An item with this SKU already exists" };
      }
    }

    const updatedItem = await prisma.$transaction(async (tx) => {
      const updated = await tx.inventoryItem.update({ where: { id }, data });

      if (data.quantity !== undefined && data.quantity !== item.quantity) {
        await recordMovement(tx, {
          organizationId: session.organizationId,
          inventoryItemId: id,
          type: "adjustment",
          quantity: Math.abs(data.quantity - item.quantity),
          quantityBefore: item.quantity,
          quantityAfter: updated.quantity,
          reason: "Quantity corrected via the edit form",
          performedById: session.user.id,
        });
      }

      return updated;
    });

    await maybeSendLowStockAlert(session.organizationId, updatedItem, item.quantity);

    revalidateInventory(id);
    return { success: true as const, item: updatedItem };
  } catch (error) {
    return handleActionError(error, "Failed to update inventory item");
  }
}

export async function takeOutStock(data: {
  inventoryItemId: string;
  quantity: number;
  destination: string;
  reason: string;
  /**
   * Where it went, as a record rather than a sentence. When this names
   * something, the cost of the parts lands on it.
   */
  truckId?: string | null;
  trailerId?: string | null;
  tripId?: string | null;
  driverId?: string | null;
  /**
   * Which expense category the cost posts to. Required when a destination is
   * named — otherwise there is nowhere for the money to land. Pre-filled from
   * the item's own default by the form.
   */
  expenseCategoryId?: string | null;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  const destination = data.destination.trim();
  const reason = data.reason.trim();
  if (!validQuantity(data.quantity)) {
    return { success: false as const, error: "Quantity must be a whole number greater than zero" };
  }
  if (!destination) {
    return { success: false as const, error: "Say where the stock is going" };
  }
  if (!reason) {
    return { success: false as const, error: "Say why the stock is being taken out" };
  }

  const going: StockDestination = {
    truckId: data.truckId || null,
    trailerId: data.trailerId || null,
    tripId: data.tripId || null,
    driverId: data.driverId || null,
  };
  const named = Object.values(going).filter(Boolean).length;
  if (named > 1) {
    return {
      success: false as const,
      error: "Stock goes to one place at a time — pick a truck, a trailer, a trip or a driver.",
    };
  }

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, organizationId: session.organizationId },
      select: { id: true, name: true, unit: true, unitCost: true, defaultExpenseCategoryId: true },
    });
    if (!item) {
      return { success: false as const, error: "Item not found" };
    }

    // The cost only lands somewhere if we know both where it went and what
    // kind of cost it is. Say which is missing rather than silently writing
    // nothing, which is what the old behaviour amounted to.
    const categoryId = data.expenseCategoryId || item.defaultExpenseCategoryId;
    const postCost = named === 1 && Boolean(categoryId) && (item.unitCost ?? 0) > 0;
    if (named === 1 && !categoryId) {
      return {
        success: false as const,
        error:
          "Choose which kind of expense this is, so the cost lands in the right place. The item can carry a default for next time.",
      };
    }

    const { before, updated, posted } = await prisma.$transaction(async (tx) => {
      const result = await decrementStock(tx, session.organizationId, data.inventoryItemId, data.quantity);

      const expense = postCost
        ? await postStockExpense(tx, {
            organizationId: session.organizationId,
            categoryId: categoryId!,
            item,
            quantity: data.quantity,
            unitCost: item.unitCost!,
            date: new Date(),
            destination: going,
            reason,
          })
        : null;

      await recordMovement(tx, {
        organizationId: session.organizationId,
        inventoryItemId: data.inventoryItemId,
        type: "out",
        quantity: data.quantity,
        quantityBefore: result.before,
        quantityAfter: result.updated.quantity,
        destination,
        reason,
        performedById: session.user.id,
        ...going,
        expenseId: expense?.expense.id ?? null,
      });
      return { ...result, posted: expense };
    });

    await maybeSendLowStockAlert(session.organizationId, updated, before);

    revalidateInventory(data.inventoryItemId);
    // The truck, trailer, trip or driver now carries the cost, so its page is
    // stale.
    if (going.truckId) revalidatePath(`/fleet/trucks/${going.truckId}`);
    if (going.trailerId) revalidatePath(`/fleet/trailers/${going.trailerId}`);
    if (going.tripId) revalidatePath(`/operations/trips/${going.tripId}`);
    if (going.driverId) revalidatePath(`/fleet/drivers/${going.driverId}`);
    if (posted) revalidatePath("/finance/expenses");

    return { success: true as const, item: updated, postedAmount: posted?.amount ?? null };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { success: false as const, error: error.message };
    }
    return handleActionError(error, "Failed to take out stock");
  }
}

export async function addStock(data: {
  inventoryItemId: string;
  quantity: number;
  source?: string;
  reason?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  if (!validQuantity(data.quantity)) {
    return { success: false as const, error: "Quantity must be a whole number greater than zero" };
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.findFirst({
        where: { id: data.inventoryItemId, organizationId: session.organizationId },
      });
      if (!item) throw new Error("Item not found");

      const result = await tx.inventoryItem.update({
        where: { id: item.id },
        data: { quantity: { increment: data.quantity } },
      });

      await recordMovement(tx, {
        organizationId: session.organizationId,
        inventoryItemId: item.id,
        type: "in",
        quantity: data.quantity,
        quantityBefore: result.quantity - data.quantity,
        quantityAfter: result.quantity,
        destination: data.source?.trim() || undefined,
        reason: data.reason?.trim() || undefined,
        performedById: session.user.id,
      });

      return result;
    });

    revalidateInventory(data.inventoryItemId);
    return { success: true as const, item: updated };
  } catch (error) {
    return handleActionError(error, "Failed to add stock");
  }
}

export async function deleteInventoryItem(id: string,
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "inventory_item",
    entityId: id,
    data: {},
    action: "delete",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { _count: { select: { allocations: true } } },
    });

    if (!item) {
      return { success: false as const, error: "Item not found" };
    }

    if (item._count.allocations > 0) {
      return { success: false as const, error: "Cannot delete an item with existing allocations" };
    }

    await prisma.inventoryItem.delete({ where: { id } });

    revalidateInventory();
    return { success: true as const };
  } catch (error) {
    return handleActionError(error, "Failed to delete inventory item");
  }
}

export async function allocatePart(data: {
  inventoryItemId: string;
  truckId: string;
  allocatedById: string;
  quantity: number;
  reason?: string;
  /**
   * Which expense category the parts' cost posts to. Falls back to the item's
   * own default, which is how this stays one click for the common case.
   */
  expenseCategoryId?: string | null;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  if (!validQuantity(data.quantity)) {
    return { success: false as const, error: "Quantity must be a whole number greater than zero" };
  }

  try {
    const [truck, employee] = await Promise.all([
      prisma.truck.findFirst({ where: { id: data.truckId, organizationId: session.organizationId } }),
      prisma.employee.findFirst({ where: { id: data.allocatedById, organizationId: session.organizationId } }),
    ]);
    if (!truck || !employee) {
      return { success: false as const, error: "Truck or employee not found" };
    }

    const item = await prisma.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, organizationId: session.organizationId },
      select: { id: true, name: true, unit: true, unitCost: true, defaultExpenseCategoryId: true },
    });
    if (!item) {
      return { success: false as const, error: "Item not found" };
    }

    // The whole point of the client's request: fitting a $20 brake pad to a
    // truck should make that truck's costs go up by $20. It needs a category
    // to post to and a price to post — without either, the allocation still
    // happens and the cost does not, which is the old behaviour and is said
    // plainly in the result rather than silently.
    const categoryId = data.expenseCategoryId || item.defaultExpenseCategoryId;
    const unitCost = item.unitCost ?? 0;
    const postCost = Boolean(categoryId) && unitCost > 0;

    const reason =
      data.reason?.trim() || `Allocated by ${employee.firstName} ${employee.lastName}`;

    const { before, updated, posted } = await prisma.$transaction(async (tx) => {
      const result = await decrementStock(tx, session.organizationId, data.inventoryItemId, data.quantity);

      const expense = postCost
        ? await postStockExpense(tx, {
            organizationId: session.organizationId,
            categoryId: categoryId!,
            item,
            quantity: data.quantity,
            unitCost,
            date: new Date(),
            destination: { truckId: data.truckId },
            reason,
          })
        : null;

      await tx.partAllocation.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          truckId: data.truckId,
          allocatedById: data.allocatedById,
          quantity: data.quantity,
          reason: data.reason,
          // Stamped here, so the value of this allocation stays right after
          // the part is repriced — the movement beside it has done this since
          // September and the allocation did not.
          unitCost: item.unitCost,
          expenseId: expense?.expense.id ?? null,
        },
      });

      await recordMovement(tx, {
        organizationId: session.organizationId,
        inventoryItemId: data.inventoryItemId,
        type: "out",
        quantity: data.quantity,
        quantityBefore: result.before,
        quantityAfter: result.updated.quantity,
        destination: `Truck ${truck.registrationNo}`,
        reason,
        performedById: session.user.id,
        truckId: data.truckId,
        expenseId: expense?.expense.id ?? null,
      });
      return { ...result, posted: expense };
    });

    await maybeSendLowStockAlert(session.organizationId, updated, before);

    revalidateInventory(data.inventoryItemId);
    revalidatePath(`/fleet/trucks/${data.truckId}`);
    if (posted) revalidatePath("/finance/expenses");

    return {
      success: true as const,
      postedAmount: posted?.amount ?? null,
      // So the caller can say "no cost was recorded, and here is why" instead
      // of implying the truck's figures moved when they did not.
      notPostedBecause: posted
        ? null
        : !categoryId
          ? "no expense category is set for this item"
          : "this item has no unit cost recorded",
    };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { success: false as const, error: error.message };
    }
    return handleActionError(error, "Failed to allocate part");
  }
}
