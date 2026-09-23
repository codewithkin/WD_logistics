import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { canViewExpensesPage } from "@/lib/permissions";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ensureAccountsExist } from "@/lib/accounts-server";
import { ExpenseCategoriesClient } from "./_components/expense-categories-client";

interface ExpenseCategoriesPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function ExpenseCategoriesPage({ searchParams }: ExpenseCategoriesPageProps) {
    const user = await requireRole(["admin", "supervisor", "staff"]);
    const params = await searchParams;
    const dateRange = getDateRangeFromParams(params, "3m");

    await ensureAccountsExist(user.organizationId);

    // The list used to show an all-time expense count and nothing else, which
    // answers neither "what does this cost us" nor "is it growing". Each row
    // now carries the period's spend, grouped in one query rather than one
    // query per category.
    const [categories, accounts, spendByCategory] = await Promise.all([
        prisma.expenseCategory.findMany({
            where: {
                organizationId: user.organizationId,
            },
            include: {
                _count: {
                    select: {
                        expenses: true,
                    },
                },
            },
            orderBy: {
                name: "asc",
            },
        }),
        prisma.financialAccount.findMany({
            where: { organizationId: user.organizationId },
            select: { id: true, name: true, type: true },
        }),
        // Staff can see the category list but not what the business spends,
        // so the figures are never fetched for them — not fetched and hidden,
        // which would still ship them in the RSC payload.
        canViewExpensesPage(user.role)
            ? prisma.expense.groupBy({
                  by: ["categoryId"],
                  where: {
                      organizationId: user.organizationId,
                      date: { gte: dateRange.from, lte: dateRange.to },
                  },
                  _sum: { amount: true },
                  _count: true,
              })
            : Promise.resolve([]),
    ]);

    const spend = new Map(
        spendByCategory.map((row) => [
            row.categoryId,
            { amount: row._sum.amount ?? 0, count: row._count },
        ]),
    );

    const categoriesWithSpend = categories.map((category) => ({
        ...category,
        periodAmount: spend.get(category.id)?.amount ?? 0,
        periodCount: spend.get(category.id)?.count ?? 0,
    }));

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title="Expense Categories"
                    description={`What each category costs — ${dateRange.label}`}
                    backHref="/finance/expenses"
                />
                <PagePeriodSelector defaultPreset="3m" />
            </div>
            <ExpenseCategoriesClient
                categories={categoriesWithSpend}
                accounts={accounts}
                role={user.role}
                periodLabel={dateRange.label}
                showSpend={canViewExpensesPage(user.role)}
            />
        </div>
    );
}
