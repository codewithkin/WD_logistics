import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../_components/expense-form";
import { requireRole } from "@/lib/session";
import { canViewExpensesPage } from "@/lib/permissions";
import { redirect } from "next/navigation";

interface NewExpensePageProps {
    searchParams: Promise<{
        tripId?: string;
        truckId?: string;
        driverId?: string;
        supplier?: string;
        business?: string;
    }>;
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
    const user = await requireRole(["admin", "supervisor"]);
    const params = await searchParams;

    // Check if user can view expenses page
    if (!canViewExpensesPage(user.role)) {
        redirect("/dashboard");
    }

    // Categories, trucks, trailers, trips, drivers and suppliers used to be
    // preloaded here. The form's pickers search for them instead — which also
    // removes the old 30-day cut-off on the trip list, so an expense can now be
    // attached to a trip that ran last quarter.
    const prefilledTripId = params.tripId || undefined;
    const prefilledTruckId = params.truckId || undefined;
    const prefilledDriverId = params.driverId || undefined;
    const prefilledSupplierId = params.supplier || undefined;
    const prefilledIsBusinessExpense = params.business === "true";

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Add Expense"
                description="Record a new business expense"
            />
            <div className="w-full">
                <ExpenseForm
                    prefilledTripId={prefilledTripId}
                    prefilledTruckId={prefilledTruckId}
                    prefilledDriverId={prefilledDriverId}
                    prefilledSupplierId={prefilledSupplierId}
                    prefilledIsBusinessExpense={prefilledIsBusinessExpense}
                />
            </div>
        </div>
    );
}
