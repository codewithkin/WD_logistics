import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { TruckForm } from "../_components/truck-form";

export default async function NewTruckPage() {
    await requireRole(["admin", "supervisor"]);

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
