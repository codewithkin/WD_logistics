import { PageHeader } from "@/components/layout/page-header";
import { ExpensesOverview } from "./_components/expenses-overview";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { ExpensesPeriodSelector } from "./_components/expenses-period-selector";

interface ExpensesPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
    const params = await searchParams;
    const user = await requireRole(["admin", "supervisor", "staff"]);

    // Get date range from URL params
    const dateRange = getDateRangeFromParams(params, "1m");

    // Fetch categories
    const categories = await prisma.expenseCategory.findMany({
        where: { organizationId: user.organizationId },
        include: {
            _count: {
                select: { expenses: true },
            },
        },
        orderBy: { name: "asc" },
    });

    // Fetch expenses within the selected period (excluding supplier-specific expenses)
    const expenses = await prisma.expense.findMany({
        where: {
            organizationId: user.organizationId,
            date: {
                gte: dateRange.from,
                lte: dateRange.to,
            },
            // Exclude pure supplier expenses - those are tracked in supplier payments
            OR: [
                { supplierId: null },
                { isBusinessExpense: false },
            ],
        },
        include: {
            category: {
                select: {
                    id: true,
                    name: true,
                    color: true,
                },
            },
            truckExpenses: {
                include: {
                    truck: {
                        select: {
                            registrationNo: true,
                        },
                    },
                },
            },
            tripExpenses: {
                include: {
                    trip: {
                        select: {
                            id: true,
                            originCity: true,
                            destinationCity: true,
                        },
                    },
                },
            },
            driverExpenses: {
                include: {
                    driver: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                },
            },
        },
        orderBy: {
            date: "desc",
        },
    });

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Expenses"
                    description={`Track and manage expenses - ${dateRange.label}`}
                />
                <ExpensesPeriodSelector />
            </div>
            <ExpensesOverview categories={categories} expenses={expenses} periodLabel={dateRange.label} />
        </div>
    );
}
