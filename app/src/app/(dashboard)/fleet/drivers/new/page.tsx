import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { DriverForm } from "../_components/driver-form";

export default async function NewDriverPage() {
    await requireRole(["admin", "supervisor"]);

    return (
        <div>
            <PageHeader
                title="Add New Driver"
                description="Add a new driver to your fleet"
                backHref="/fleet/drivers"
            />
            <DriverForm availableTrucks={[]} />
        </div>
    );
}
