import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "../_components/customer-form";

export default async function NewCustomerPage() {
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding a customer" />;

    return (
        <div>
            <PageHeader
                title="Add New Customer"
                description="Create a new customer profile"
                backHref="/customers"
            />
            <CustomerForm />
        </div>
    );
}
