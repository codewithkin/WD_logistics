import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../_components/expense-form";
import { listAccountOptions } from "@/lib/accounts-server";

interface NewExpensePageProps {
    searchParams: Promise<{ tripId?: string }>;
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
    const params = await searchParams;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="recording an expense" />;

    // Trips and categories are no longer preloaded — the form's pickers search
    // for them, so this page stays the same size whatever the trip count is.
    // The three accounts are, because "paid from" is a three-way choice.
    const accounts = await listAccountOptions(access.session.organizationId);

    return (
        <div>
            <PageHeader
                title="Add Expense"
                description="Record a new expense"
                backHref="/operations/expenses"
            />
            <ExpenseForm defaultTripId={params.tripId} accounts={accounts} />
        </div>
    );
}
