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

  try {
    const { before, updated } = await prisma.$transaction(async (tx) => {
      const result = await decrementStock(tx, session.organizationId, data.inventoryItemId, data.quantity);
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
      });
      return result;
    });

    await maybeSendLowStockAlert(session.organizationId, updated, before);

    revalidateInventory(data.inventoryItemId);
    return { success: true as const, item: updated };
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

    const { before, updated } = await prisma.$transaction(async (tx) => {
      const result = await decrementStock(tx, session.organizationId, data.inventoryItemId, data.quantity);
      await tx.partAllocation.create({ data });
      await recordMovement(tx, {
        organizationId: session.organizationId,
        inventoryItemId: data.inventoryItemId,
        type: "out",
        quantity: data.quantity,
        quantityBefore: result.before,
        quantityAfter: result.updated.quantity,
        destination: `Truck ${truck.registrationNo}`,
        reason: data.reason?.trim() || `Allocated by ${employee.firstName} ${employee.lastName}`,
        performedById: session.user.id,
      });
      return result;
    });

    await maybeSendLowStockAlert(session.organizationId, updated, before);

    revalidateInventory(data.inventoryItemId);
    return { success: true as const };
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return { success: false as const, error: error.message };
    }
    return handleActionError(error, "Failed to allocate part");
  }
}
