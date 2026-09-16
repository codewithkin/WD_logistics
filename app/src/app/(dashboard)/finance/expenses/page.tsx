import { PageHeader } from "@/components/layout/page-header";
import { ExpensesOverview } from "./_components/expenses-overview";
import { AccountBalancesSummary } from "./_components/account-balances-summary";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { ExpensesPeriodSelector } from "./_components/expenses-period-selector";
import { canViewExpensesPage, canViewAccountBalances } from "@/lib/permissions";
import { getAccounts } from "../accounts/actions";
import { redirect } from "next/navigation";

interface ExpensesPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function ExpensesPage({ searchParams }: ExpensesPageProps) {
    const params = await searchParams;
    const user = await requireRole(["admin", "supervisor"]);

    // Check if user can view expenses page
    if (!canViewExpensesPage(user.role)) {
        redirect("/dashboard");
    }

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

    const showAccountBalances = canViewAccountBalances(user.role);
    const accounts = showAccountBalances ? await getAccounts() : [];

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Expenses"
                    description={`Track and manage expenses - ${dateRange.label}`}
                />
                <ExpensesPeriodSelector />
            </div>
            {showAccountBalances && <AccountBalancesSummary accounts={accounts} />}
            <ExpensesOverview categories={categories} expenses={expenses} periodLabel={dateRange.label} />
        </div>
    );
}
