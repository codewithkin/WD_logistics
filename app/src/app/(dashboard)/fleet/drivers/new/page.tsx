import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { DriverForm } from "../_components/driver-form";

export default async function NewDriverPage() {
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding a driver" />;

    return (
        <div>
            <PageHeader
                title="Add New Driver"
                description="Add a new driver to your fleet"
                backHref="/fleet/drivers"
            />
            <DriverForm />
        </div>
    );
}
