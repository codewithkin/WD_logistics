import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryTable } from "./_components/inventory-table";
import { InventorySummary } from "./_components/inventory-summary";
import { canViewInventoryValue, canManageInventory } from "@/lib/permissions";
import { Plus } from "lucide-react";

export default async function InventoryPage() {
    const session = await requireRole(["admin", "supervisor"]);
    const { role, organizationId } = session;

    const items = await prisma.inventoryItem.findMany({
        where: { organizationId },
        select: {
            id: true,
            name: true,
            sku: true,
            category: true,
            unit: true,
            quantity: true,
            minQuantity: true,
            unitCost: true,
            location: true,
        },
        orderBy: { name: "asc" },
    });

    const canSeeValue = canViewInventoryValue(role);
    const canManage = canManageInventory(role);

    const totalItems = items.length;
    const lowStockCount = items.filter((item) => item.quantity <= item.minQuantity).length;

    let totalValue: number | null = null;
    let categoryBreakdown: { category: string; value: number; itemCount: number }[] = [];

    if (canSeeValue) {
        const byCategory = new Map<string, { value: number; itemCount: number }>();
        let sum = 0;
        for (const item of items) {
            const value = (item.unitCost ?? 0) * item.quantity;
            sum += value;
            const key = item.category || "Uncategorized";
            const existing = byCategory.get(key) ?? { value: 0, itemCount: 0 };
            byCategory.set(key, { value: existing.value + value, itemCount: existing.itemCount + 1 });
        }
        totalValue = sum;
        categoryBreakdown = Array.from(byCategory.entries())
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.value - a.value);
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Inventory"
                description="Track spare parts and warehouse stock"
                action={
                    canManage
                        ? { label: "Add Item", href: "/inventory/new", icon: Plus }
                        : undefined
                }
            />

            <InventorySummary
                totalItems={totalItems}
                totalValue={totalValue}
                lowStockCount={lowStockCount}
                categoryBreakdown={categoryBreakdown}
            />

            <InventoryTable items={items} role={role} canSeeValue={canSeeValue} />
        </div>
    );
}
