"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export async function createInventoryItem(data: {
  name: string;
  sku?: string;
  category?: string;
  quantity: number;
  minQuantity: number;
  unitCost?: number;
  location?: string;
  supplier?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    if (data.sku) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, organizationId: session.organizationId },
      });
      if (existing) {
        return { success: false, error: "SKU already exists" };
      }
    }

    const item = await prisma.inventoryItem.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/inventory");
    return { success: true, item };
  } catch (error) {
    console.error("Failed to create inventory item:", error);
    return { success: false, error: "Failed to create inventory item" };
  }
}

export async function updateInventoryItem(
  id: string,
  data: {
    name?: string;
    sku?: string;
    category?: string;
    quantity?: number;
    minQuantity?: number;
    unitCost?: number;
    location?: string;
    supplier?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const item = await prisma.inventoryItem.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!item) {
      return { success: false, error: "Inventory item not found" };
    }

    if (data.sku && data.sku !== item.sku) {
      const existing = await prisma.inventoryItem.findFirst({
        where: { sku: data.sku, organizationId: session.organizationId },
      });
      if (existing) {
        return { success: false, error: "SKU already exists" };
      }
    }

    const updatedItem = await prisma.inventoryItem.update({
      where: { id },
      data,
    });

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
      return { success: false, error: "Inventory item not found" };
    }

    if (item._count.allocations > 0) {
      return {
        success: false,
        error: "Cannot delete item with existing allocations",
      };
    }

    await prisma.inventoryItem.delete({ where: { id } });

    revalidatePath("/inventory");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete inventory item:", error);
    return { success: false, error: "Failed to delete inventory item" };
  }
}

export async function allocateInventory(data: {
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
      return { success: false, error: "Inventory item not found" };
    }

    if (data.quantity > item.quantity) {
      return { success: false, error: "Insufficient quantity available" };
    }

    const [allocation] = await prisma.$transaction([
      prisma.partAllocation.create({
        data: {
          inventoryItemId: data.inventoryItemId,
          truckId: data.truckId,
          allocatedById: data.allocatedById,
          quantity: data.quantity,
          reason: data.reason,
        },
      }),
      prisma.inventoryItem.update({
        where: { id: data.inventoryItemId },
        data: { quantity: item.quantity - data.quantity },
      }),
    ]);

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${data.inventoryItemId}`);
    return { success: true, allocation };
  } catch (error) {
    console.error("Failed to allocate inventory:", error);
    return { success: false, error: "Failed to allocate inventory" };
  }
}

export async function deletePartAllocation(allocationId: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const allocation = await prisma.partAllocation.findFirst({
      where: { id: allocationId },
      include: { 
        inventoryItem: {
          select: { organizationId: true, quantity: true }
        }
      },
    });

    if (!allocation || allocation.inventoryItem.organizationId !== session.organizationId) {
      return { success: false, error: "Allocation not found" };
    }

    // Return quantity to inventory
    await prisma.$transaction([
      prisma.partAllocation.delete({
        where: { id: allocationId },
      }),
      prisma.inventoryItem.update({
        where: { id: allocation.inventoryItemId },
        data: { quantity: allocation.inventoryItem.quantity + allocation.quantity },
      }),
    ]);

    revalidatePath("/inventory");
    revalidatePath(`/inventory/${allocation.inventoryItemId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to delete allocation:", error);
    return { success: false, error: "Failed to delete allocation" };
  }
}
