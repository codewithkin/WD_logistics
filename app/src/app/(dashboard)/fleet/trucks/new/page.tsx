import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TruckForm } from "../_components/truck-form";

export default async function NewTruckPage() {
    const access = await pageAccess(["admin", "supervisor", "staff"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding a truck" />;

    return (
        <div>
            <PageHeader
                title="Add New Truck"
                description="Add a new truck to your fleet"
                backHref="/fleet/trucks"
            />
            <TruckForm />
        </div>
    );
}
