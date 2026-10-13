"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notifyByTierKey, notifyIfAccountOverdrawn } from "@/lib/notifications";
import { ACCOUNT_TYPES, AccountType, InsufficientBalanceError } from "@/lib/accounts";
import {
  ensureAccountsExist,
  recomputeAccountBalance,
  recordManualMovement,
  transferFunds,
} from "@/lib/accounts-server";

export async function getAccounts() {
  const session = await requireRole(["admin", "supervisor"]);

  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId: session.organizationId },
    include: { _count: { select: { transactions: true } } },
  });

  // Keep the accounts deleted by Reset Everything deleted. Ensure defaults
  // only when the user actually records a transaction, not by viewing page.
  return ACCOUNT_TYPES.flatMap((type) =>
    accounts.filter((account) => account.type === type),
  );
}

export async function transferFundsAction(data: {
  fromType: AccountType;
  toType: AccountType;
  amount: number;
  description?: string;
}) {
  const session = await requireRole(["admin"]);

  if (data.fromType === data.toType) {
    return { success: false, error: "Source and destination accounts must be different" };
  }
  if (data.fromType === "bank" || data.toType === "bank") {
    return { success: false, error: "Transfers are only supported between Cash and Petty Cash" };
  }
  if (!(data.amount > 0)) {
    return { success: false, error: "Amount must be greater than zero" };
  }

  await ensureAccountsExist(session.organizationId);

  const [fromAccount, toAccount] = await Promise.all([
    prisma.financialAccount.findUniqueOrThrow({
      where: { organizationId_type: { organizationId: session.organizationId, type: data.fromType } },
    }),
    prisma.financialAccount.findUniqueOrThrow({
      where: { organizationId_type: { organizationId: session.organizationId, type: data.toType } },
    }),
  ]);

  try {
    await transferFunds({
      fromAccountId: fromAccount.id,
      toAccountId: toAccount.id,
      amount: data.amount,
      description: data.description,
      createdById: session.user.id,
    });
  } catch (error) {
    if (error instanceof InsufficientBalanceError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to transfer funds:", error);
    return { success: false, error: "Failed to transfer funds" };
  }

  revalidatePath("/finance/accounts");
  revalidatePath("/finance/expenses");
  return { success: true };
}

export async function recordAccountMovementAction(data: {
  accountType: AccountType;
  direction: "deposit" | "withdrawal";
  amount: number;
  description: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  const amount = Math.round(data.amount * 100) / 100;
  const description = data.description.trim();

  if (!ACCOUNT_TYPES.includes(data.accountType)) {
    return { success: false, error: "Unknown account" };
  }
  if (data.direction !== "deposit" && data.direction !== "withdrawal") {
    return { success: false, error: "Choose money in or money out" };
  }
  // Money *into* an account is admin-only: it is the one movement with no
  // paper trail behind it, so it is the one worth restricting. Money out
  // stays open to supervisors, who need it to run the yard day to day.
  if (data.direction === "deposit" && session.role !== "admin") {
    return {
      success: false,
      error: "Only an admin can record money into an account. Ask one to enter this deposit.",
    };
  }
  if (!(amount > 0)) {
    return { success: false, error: "Amount must be greater than zero" };
  }
  if (description.length < 3) {
    return { success: false, error: "Add a short note saying what this money is for" };
  }

  await ensureAccountsExist(session.organizationId);

  const account = await prisma.financialAccount.findUniqueOrThrow({
    where: { organizationId_type: { organizationId: session.organizationId, type: data.accountType } },
  });

  try {
    await recordManualMovement({
      accountId: account.id,
      type: data.direction,
      amount,
      description,
      createdById: session.user.id,
    });
  } catch (error) {
    console.error("Failed to record account movement:", error);
    return { success: false, error: "Failed to record this entry" };
  }

  // Money out is no longer refused for want of funds. Whoever recorded it
  // may not be allowed to see the balance they just pushed below zero, so
  // the owner is told instead.
  if (data.direction === "withdrawal") {
    await notifyIfAccountOverdrawn({
      organizationId: session.organizationId,
      accountId: account.id,
      actorName: session.user.name,
      actorEmail: session.user.email,
      what: `${formatMoney(amount)} out — ${description}`,
    });
  }

  // Money moving in or out of the three accounts is exactly what an admin
  // wants told about without opening the ledger.
  const isLargeWithdrawal = data.direction === "withdrawal" && amount >= 1000;
  if (data.direction === "deposit" || isLargeWithdrawal) {
    await notifyByTierKey({
      key: data.direction === "deposit" ? "account_money_in" : "account_large_money_out",
      organizationId: session.organizationId,
      title:
        data.direction === "deposit"
          ? `Money in: ${account.name}`
          : `Large withdrawal: ${account.name}`,
      message: `${formatMoney(amount)} ${
        data.direction === "deposit" ? "into" : "out of"
      } ${account.name} by ${session.user.name} — ${description}`,
      link: "/finance/accounts",
      excludeUserEmails: [session.user.email],
      metadata: { accountType: data.accountType, amount, direction: data.direction },
    });
  }

  revalidatePath("/finance/accounts");
  revalidatePath("/finance/expenses");
  return { success: true };
}

/** Consistent money formatting for notification text. */
function formatMoney(amount: number): string {
  return `$${amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Sets what was in an account before the system started counting.
 *
 * This used to refuse once any transaction existed, which locked out exactly
 * the people who needed it: a yard that records a week of fuel before anyone
 * thinks to enter the float could never enter the float. The figure is now
 * editable whenever, and the balance is reworked from the ledger afterwards
 * rather than overwritten — so the week of fuel still comes off it.
 *
 * No correcting ledger row is written, deliberately. The opening balance is
 * the ledger's anchor, not an entry in it; writing both would count the change
 * twice. Admins are told instead, since this is the one figure that moves a
 * balance with no paper trail behind it.
 */
export async function setStartingBalance(type: AccountType, amount: number) {
  const session = await requireRole(["admin"]);

  if (!(amount >= 0)) {
    return { success: false, error: "Starting balance cannot be negative" };
  }

  await ensureAccountsExist(session.organizationId);

  const account = await prisma.financialAccount.findUniqueOrThrow({
    where: { organizationId_type: { organizationId: session.organizationId, type } },
    include: { _count: { select: { transactions: true } } },
  });

  const previousOpening = account.startingBalance;
  if (Math.abs(previousOpening - amount) < 0.005) {
    return { success: true, unchanged: true as const };
  }

  await prisma.financialAccount.update({
    where: { id: account.id },
    data: { startingBalance: amount },
  });
  const repaired = await recomputeAccountBalance(account.id);

  await notifyByTierKey({
    key: "account_money_in",
    organizationId: session.organizationId,
    title: `Opening balance changed: ${account.name}`,
    message:
      `${session.user.name} set the opening balance of ${account.name} to ` +
      `${formatMoney(amount)} (was ${formatMoney(previousOpening)}). The balance now reads ` +
      `${formatMoney(repaired.balance)} after ${account._count.transactions} recorded movement(s).`,
    link: "/finance/accounts",
    excludeUserEmails: [session.user.email],
    metadata: { accountType: type, opening: amount, previousOpening },
  });

  revalidatePath("/finance/accounts");
  revalidatePath("/finance/expenses");
  return { success: true, balance: repaired.balance };
}

/**
 * Reworks all three balances from their ledgers and says what it changed.
 *
 * Admin-only, and on purpose a button rather than something that runs on every
 * page load: a balance that disagrees with its own ledger is a bug worth
 * seeing, not papering over. A clean system reports "nothing to repair".
 */
export async function recomputeAccountBalances() {
  const session = await requireRole(["admin"]);

  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true },
  });

  const results = [];
  for (const account of accounts) {
    results.push(await recomputeAccountBalance(account.id));
  }

  const repaired = results.filter((result) => result.changed);
  if (repaired.length > 0) {
    await notifyByTierKey({
      key: "account_money_in",
      organizationId: session.organizationId,
      title: "Account balances repaired",
      message: repaired
        .map(
          (result) =>
            `${result.name}: ${formatMoney(result.previous)} → ${formatMoney(result.balance)}`,
        )
        .join("; "),
      link: "/finance/accounts",
      excludeUserEmails: [session.user.email],
      metadata: { repaired: repaired.length },
    });
  }

  revalidatePath("/finance/accounts");
  revalidatePath("/finance/expenses");
  return {
    success: true as const,
    checked: results.length,
    repaired: repaired.map((result) => ({
      name: result.name,
      previous: result.previous,
      balance: result.balance,
    })),
  };
}
