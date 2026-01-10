import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryTable } from "./_components/inventory-table";
import { Plus } from "lucide-react";

export default async function InventoryPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const inventoryItems = await prisma.inventoryItem.findMany({
        where: { organizationId },
        include: {
            _count: {
                select: { allocations: true },
            },
        },
        orderBy: { name: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Inventory"
                description="Manage parts and supplies inventory"
                action={
                    canCreate
                        ? {
                            label: "Add Item",
                            href: "/inventory/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <InventoryTable items={inventoryItems} role={role} />
        </div>
    );
}
