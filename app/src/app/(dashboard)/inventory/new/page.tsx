import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryForm } from "../_components/inventory-form";
import { canViewInventoryValue } from "@/lib/permissions";

export default async function NewInventoryItemPage() {
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding a stock item" />;
    const session = access.session;

    const labels = await prisma.inventoryLabel.findMany({
        where: { organizationId: session.organizationId },
        select: { id: true, name: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    return (
        <div>
            <PageHeader
                title="Add Inventory Item"
                description="Add a new part or stock item to the warehouse"
                backHref="/inventory"
            />
            <InventoryForm labels={labels} canSeeValue={canViewInventoryValue(session.role)} />
        </div>
    );
}
