import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { isDebitTransaction } from "@/lib/accounts";
import { canRecordMoneyIn, canRecordMoneyOut, canTransferFunds } from "@/lib/permissions";
import { AccountsClient } from "./_components/accounts-client";
import { getAccounts } from "./actions";

interface AccountsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
    const params = await searchParams;
    const session = await requireRole(["admin", "supervisor"]);
    const { organizationId, role } = session;
    const dateRange = getDateRangeFromParams(params, "1m");

    const accounts = await getAccounts();

    const [transactions, lastActivity] = await Promise.all([
        prisma.accountTransaction.findMany({
            where: {
                account: { organizationId },
                date: { gte: dateRange.from, lte: dateRange.to },
            },
            orderBy: [{ date: "desc" }, { createdAt: "desc" }],
            include: {
                account: { select: { type: true, name: true } },
                createdBy: { select: { id: true, name: true } },
            },
        }),
        prisma.accountTransaction.groupBy({
            by: ["accountId"],
            where: { account: { organizationId } },
            _max: { date: true },
        }),
    ]);

    const accountSummaries = accounts.map((account) => {
        const accountTx = transactions.filter((t) => t.accountId === account.id);
        const moneyOut = accountTx.filter((t) => isDebitTransaction(t.type)).reduce((sum, t) => sum + t.amount, 0);
        const moneyIn = accountTx.filter((t) => !isDebitTransaction(t.type)).reduce((sum, t) => sum + t.amount, 0);
        return {
            id: account.id,
            type: account.type,
            name: account.name,
            balance: account.balance,
            startingBalance: account.startingBalance,
            transactionCount: account._count.transactions,
            periodIn: moneyIn,
            periodOut: moneyOut,
            lastActivity: lastActivity.find((l) => l.accountId === account.id)?._max.date ?? null,
        };
    });

    return (
        <div className="space-y-6">
            <PageHeader
                title="Accounts"
                description={`Cash, Bank and Petty Cash — balances and every movement of money · ${dateRange.label}`}
            >
                <PagePeriodSelector defaultPreset="1m" />
            </PageHeader>
            <AccountsClient
                accounts={accountSummaries}
                transactions={transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: t.amount,
                    balanceAfter: t.balanceAfter,
                    description: t.description,
                    expenseId: t.expenseId,
                    date: t.date,
                    accountType: t.account.type,
                    accountName: t.account.name,
                    createdBy: t.createdBy,
                }))}
                periodLabel={dateRange.label}
                role={role}
                canRecordIn={canRecordMoneyIn(role)}
                canRecordOut={canRecordMoneyOut(role)}
                canTransfer={canTransferFunds(role)}
                currentUserId={session.user.id}
            />
        </div>
    );
}
