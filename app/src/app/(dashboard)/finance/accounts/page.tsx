import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { DEBIT_TYPE_LIST, isDebitTransaction } from "@/lib/accounts";
import {
    canRecordMoneyIn,
    canRecordMoneyOut,
    canTransferFunds,
    canViewAccountBalances,
    canViewMoneyIn,
} from "@/lib/permissions";
import { AccountsClient } from "./_components/accounts-client";
import { getAccounts } from "./actions";

interface AccountsPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function AccountsPage({ searchParams }: AccountsPageProps) {
    const params = await searchParams;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="the cash, bank and petty cash accounts" />;
    const session = access.session;
    const { organizationId, role } = session;
    const dateRange = getDateRangeFromParams(params, "1m");

    // What a supervisor gets here changed on 2026-09-30: no balances, no
    // totals, and no money-in lines — because a list of everything in and out
    // *is* the balance, arrived at with a calculator. They keep the entries
    // they recorded themselves, so they can check their own work.
    const showBalances = canViewAccountBalances(role);
    const showMoneyIn = canViewMoneyIn(role);

    const accounts = await getAccounts();

    const [transactions, lastActivity] = await Promise.all([
        prisma.accountTransaction.findMany({
            where: {
                account: { organizationId },
                date: { gte: dateRange.from, lte: dateRange.to },
                ...(showMoneyIn
                    ? {}
                    : { type: { in: [...DEBIT_TYPE_LIST] }, createdById: session.user.id }),
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
            // Left out entirely rather than passed and not rendered: a value
            // handed to a client component is in the RSC payload and readable
            // in devtools whether it appears on screen or not.
            ...(showBalances
                ? {
                      balance: account.balance,
                      startingBalance: account.startingBalance,
                      periodIn: moneyIn,
                      periodOut: moneyOut,
                  }
                : {}),
            transactionCount: account._count.transactions,
            lastActivity: lastActivity.find((l) => l.accountId === account.id)?._max.date ?? null,
        };
    });

    // What they spent themselves — a total they entered, which is theirs.
    const ownSpend = showBalances
        ? null
        : transactions.reduce((sum, t) => sum + t.amount, 0);

    return (
        <div className="space-y-6">
            <PageHeader
                title="Accounts"
                description={
                    showBalances
                        ? `Cash, Bank and Petty Cash — balances and every movement of money · ${dateRange.label}`
                        : `Record money paid out of Cash, Bank or Petty Cash · ${dateRange.label}`
                }
            >
                <PagePeriodSelector defaultPreset="1m" />
            </PageHeader>
            <AccountsClient
                accounts={accountSummaries}
                transactions={transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: t.amount,
                    ...(showBalances ? { balanceAfter: t.balanceAfter } : {}),
                    description: t.description,
                    expenseId: t.expenseId,
                    date: t.date,
                    accountType: t.account.type,
                    accountName: t.account.name,
                    createdBy: t.createdBy,
                }))}
                periodLabel={dateRange.label}
                role={role}
                showBalances={showBalances}
                ownSpend={ownSpend}
                canRecordIn={canRecordMoneyIn(role)}
                canRecordOut={canRecordMoneyOut(role)}
                canTransfer={canTransferFunds(role)}
                currentUserId={session.user.id}
            />
        </div>
    );
}
