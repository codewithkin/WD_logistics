import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { ExpensesTable } from "./_components/expenses-table";
import { Plus } from "lucide-react";

interface ExpensesPageProps {
    searchParams: Promise<{ tripId?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
    const params = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const whereClause: Record<string, unknown> = { organizationId };

    // Filter by trip if specified
    if (params.tripId) {
        whereClause.tripExpenses = {
            some: { tripId: params.tripId }
        };
    }

    const expenses = await prisma.expense.findMany({
        where: whereClause,
        include: {
            category: true,
            tripExpenses: {
                include: {
                    trip: {
                        include: {
                            truck: true,
                            driver: true,
                        },
                    },
                },
            },
        },
        orderBy: { date: "desc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Expenses"
                description="Track and manage expenses"
                action={
                    canCreate
                        ? {
                            label: "Add Expense",
                            href: "/operations/expenses/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <ExpensesTable expenses={expenses} role={role} />
        </div>
    );
}
