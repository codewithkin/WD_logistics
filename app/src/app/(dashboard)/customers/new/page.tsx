import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerForm } from "../_components/customer-form";

export default async function NewCustomerPage() {
    await requireRole(["admin", "supervisor"]);

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
