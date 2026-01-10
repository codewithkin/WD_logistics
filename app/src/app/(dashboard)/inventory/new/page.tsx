import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { InventoryItemForm } from "../_components/inventory-form";

export default async function NewInventoryItemPage() {
    await requireRole(["admin", "supervisor"]);

    return (
        <div>
            <PageHeader
                title="Add Inventory Item"
                description="Add a new item to inventory"
                backHref="/inventory"
            />
            <InventoryItemForm />
        </div>
    );
}
