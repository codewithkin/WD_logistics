import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { SupplierForm } from "../_components/supplier-form";

export default async function NewSupplierPage() {
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding a supplier" />;

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
