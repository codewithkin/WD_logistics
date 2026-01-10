import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExpenseForm } from "../../_components/expense-form";

interface EditExpensePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditExpensePage({ params }: EditExpensePageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const expense = await prisma.tripExpense.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!expense) {
        notFound();
    }

    const [trips, categories] = await Promise.all([
        prisma.trip.findMany({
            where: { organizationId: session.organizationId },
            select: { id: true, origin: true, destination: true },
            orderBy: { startDate: "desc" },
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
                title="Edit Expense"
                description="Update expense details"
                backHref="/operations/expenses"
            />
            <ExpenseForm expense={expense} trips={trips} categories={categories} />
        </div>
    );
}
