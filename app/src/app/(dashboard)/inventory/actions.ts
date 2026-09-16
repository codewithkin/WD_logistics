"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { sendPushToUsers } from "@/lib/push";
import { getTierConfig } from "@/lib/notification-tiers";

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

/** Push a low-stock alert to supervisors only when quantity CROSSES the
 * threshold (was above minQuantity, now at/below it) — not on every save
 * while it stays low, which would just be noise. */
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

export async function createInventoryItem(data: InventoryItemInput) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    if (data.sku) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, organizationId: session.organizationId },
      });
      if (existing) {
        return { success: false, error: "An item with this SKU already exists" };
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        ...data,
        minQuantity: data.minQuantity ?? 5,
        organizationId: session.organizationId,
      },
    });

    await maybeSendLowStockAlert(session.organizationId, item, null);

    revalidatePath("/inventory");
    return { success: true, item };
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    return { success: false, error: "Failed to create inventory item" };
  }
}

export async function updateInventoryItem(id: string, data: Partial<InventoryItemInput>) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (data.sku && data.sku !== item.sku) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, organizationId: session.organizationId, NOT: { id } },
      });
      if (existing) {
        return { success: false, error: "An item with this SKU already exists" };
      }
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data,
    });

    await maybeSendLowStockAlert(session.organizationId, updatedItem, item.quantity);

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${id}`);
    return { success: true, item: updatedItem };
  } catch (error) {
    console.error("Failed to update inventory item:", error);
    return { success: false, error: "Failed to update inventory item" };
  }
}

export async function deleteInventoryItem(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { _count: { select: { allocations: true } } },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (item._count.allocations > 0) {
      return { success: false, error: "Cannot delete an item with existing allocations" };
    }

    await prisma.inventoryItem.delete({ where: { id } });

    revalidatePath("/inventory");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    return { success: false, error: "Failed to delete inventory item" };
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

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id: data.inventoryItemId, organizationId: session.organizationId },
    });

    if (!item) {
      return { success: false, error: "Item not found" };
    }

    if (item.quantity < data.quantity) {
      return { success: false, error: `Only ${item.quantity} ${item.unit || "units"} available` };
    }

    const [, updatedItem] = await prisma.$transaction([
      prisma.partAllocation.create({ data }),
      prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { quantity: { decrement: data.quantity } },
      }),
    ]);

    await maybeSendLowStockAlert(session.organizationId, updatedItem, item.quantity);

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${data.inventoryItemId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to allocate part:", error);
    return { success: false, error: "Failed to allocate part" };
  }
}
