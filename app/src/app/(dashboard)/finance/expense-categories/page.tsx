import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/session";
import prisma from "@/lib/prisma";
import { ensureAccountsExist } from "@/lib/accounts";
import { ExpenseCategoriesClient } from "./_components/expense-categories-client";

export default async function ExpenseCategoriesPage() {
    const user = await requireRole(["admin", "supervisor", "staff"]);

    await ensureAccountsExist(user.organizationId);

    const [categories, accounts] = await Promise.all([
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
    ]);

    return (
        <div className="flex flex-col gap-6">
            <PageHeader
                title="Expense Categories"
                description="Manage expense categories and their settings"
                backHref="/finance/expenses"
            />
            <ExpenseCategoriesClient categories={categories} accounts={accounts} />
        </div>
    );
}
