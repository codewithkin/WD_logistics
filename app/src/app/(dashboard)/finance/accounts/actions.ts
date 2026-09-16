"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { ACCOUNT_TYPES, AccountType, InsufficientBalanceError } from "@/lib/accounts";
import { ensureAccountsExist, transferFunds } from "@/lib/accounts-server";

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
