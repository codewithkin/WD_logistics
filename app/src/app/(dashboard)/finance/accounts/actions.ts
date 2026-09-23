"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notifyByTierKey } from "@/lib/notifications";
import { ACCOUNT_TYPES, AccountType, InsufficientBalanceError } from "@/lib/accounts";
import { ensureAccountsExist, recordManualMovement, transferFunds } from "@/lib/accounts-server";

export async function getAccounts() {
  const session = await requireRole(["admin", "supervisor"]);

  await ensureAccountsExist(session.organizationId);

  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId: session.organizationId },
    include: { _count: { select: { transactions: true } } },
  });

  // Always return all three, in a stable order, regardless of DB row order
  return ACCOUNT_TYPES.map(
    (type) => accounts.find((a) => a.type === type)!
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
    if (error instanceof InsufficientBalanceError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to record account movement:", error);
    return { success: false, error: "Failed to record this entry" };
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
 * Sets an account's starting balance during initial setup. Only allowed
 * while the account has no ledger history yet — once expenses or transfers
 * have touched it, use a transfer (or record a correcting expense) instead
 * of silently rewriting the balance.
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

  if (account._count.transactions > 0) {
    return {
      success: false,
      error: "This account already has transactions — use a transfer instead of resetting the starting balance",
    };
  }

  await prisma.financialAccount.update({
    where: { id: account.id },
    data: { startingBalance: amount, balance: amount },
  });

  revalidatePath("/finance/accounts");
  return { success: true };
}
