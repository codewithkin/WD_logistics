import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierForm } from "../_components/supplier-form";

export default async function NewSupplierPage() {
    await requireRole(["admin", "supervisor"]);

    return (
        <div>
            <PageHeader
                title="Add New Supplier"
                description="Create a new supplier profile"
                backHref="/suppliers"
            />
            <SupplierForm />
        </div>
    );
}
