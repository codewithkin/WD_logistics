import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { InventoryTable } from "./_components/inventory-table";
import { InventorySummary } from "./_components/inventory-summary";
import { StockMovementsTable } from "./_components/stock-movements-table";
import { canViewInventoryValue, canManageInventory } from "@/lib/permissions";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Boxes, History, Plus } from "lucide-react";

interface InventoryPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function InventoryPage({ searchParams }: InventoryPageProps) {
    const session = await requireRole(["admin", "supervisor"]);
    const { role, organizationId } = session;
    const params = await searchParams;
    const dateRange = getDateRangeFromParams(params, "3m");

    const [items, movements] = await Promise.all([
        prisma.inventoryItem.findMany({
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
        }),
        prisma.stockMovement.findMany({
            where: {
                organizationId,
                createdAt: { gte: dateRange.from, lte: dateRange.to },
            },
            orderBy: { createdAt: "desc" },
            include: {
                performedBy: { select: { name: true } },
                inventoryItem: { select: { id: true, name: true, unit: true, unitCost: true } },
            },
        }),
    ]);

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title="Inventory"
                    description="Track spare parts and warehouse stock"
                    action={
                        canManage
                            ? { label: "Add Item", href: "/inventory/new", icon: Plus }
                            : undefined
                    }
                />
                <PagePeriodSelector defaultPreset="3m" />
            </div>

            <InventorySummary
                totalItems={totalItems}
                totalValue={totalValue}
                lowStockCount={lowStockCount}
                categoryBreakdown={categoryBreakdown}
            />

            <Tabs defaultValue="items" className="space-y-4">
                <TabsList>
                    <TabsTrigger value="items" className="gap-2">
                        <Boxes className="h-4 w-4" />
                        Items
                    </TabsTrigger>
                    <TabsTrigger value="history" className="gap-2">
                        <History className="h-4 w-4" />
                        Stock History
                    </TabsTrigger>
                </TabsList>
                <TabsContent value="items">
                    <InventoryTable items={items} role={role} canSeeValue={canSeeValue} />
                </TabsContent>
                <TabsContent value="history">
                    <Card>
                        <CardContent className="p-6">
                            <p className="text-sm text-muted-foreground mb-4">
                                Everything that came into or went out of the warehouse
                                during {dateRange.label.toLowerCase()}. Stock levels on
                                the Items tab are current, not period-bound.
                            </p>
                            <StockMovementsTable movements={movements} showItem showValue={canSeeValue} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
