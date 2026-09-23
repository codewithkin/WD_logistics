import { requireRole } from "@/lib/session";
import { canViewFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { TripForm } from "../_components/trip-form";

export default async function NewTripPage() {
    const session = await requireRole(["admin", "supervisor"]);
    const showFinancials = canViewFinancialData(session.role);

    // Trucks, drivers and customers are no longer preloaded here — the form's
    // entity pickers search the whole organisation themselves, so a growing
    // fleet no longer turns this page into a multi-thousand-row payload.
    return (
        <div>
            <PageHeader
                title="Create New Trip"
                description="Schedule a new trip"
                backHref="/operations/trips"
            />
            <TripForm showFinancials={showFinancials} />
        </div>
    );
}
