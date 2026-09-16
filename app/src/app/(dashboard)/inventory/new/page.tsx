import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryForm } from "../_components/inventory-form";
import { canViewInventoryValue } from "@/lib/permissions";

export default async function NewInventoryItemPage() {
    const session = await requireRole(["admin", "supervisor"]);

    return (
        <div>
            <PageHeader
                title="Add Inventory Item"
                description="Add a new part or stock item to the warehouse"
                backHref="/inventory"
            />
            <InventoryForm canSeeValue={canViewInventoryValue(session.role)} />
        </div>
    );
}
