import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../_components/expense-form";

interface NewExpensePageProps {
    searchParams: Promise<{ tripId?: string }>;
}

export default async function NewExpensePage({ searchParams }: NewExpensePageProps) {
    const params = await searchParams;
    const session = await requireRole(["admin", "supervisor"]);

    const [trips, categories] = await Promise.all([
        prisma.trip.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, originCity: true, destinationCity: true },
            orderBy: { scheduledDate: "desc" },
        }),
        prisma.expenseCategory.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, name: true },
            orderBy: { name: "asc" },
        }),
    ]);

    return (
        <div>
            <PageHeader
                title="Add Expense"
                description="Record a new expense"
                backHref="/operations/expenses"
            />
            <ExpenseForm trips={trips} categories={categories} defaultTripId={params.tripId} />
        </div>
    );
}
