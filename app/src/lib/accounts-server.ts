import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
  InsufficientBalanceError,
  isDebitTransaction,
  type AccountType,
  type AccountTransactionType,
} from "@/lib/accounts";

/**
 * Server-only balance mutations for the three accounts (Cash / Bank / Petty
 * Cash). All balance mutations here must run inside the same
 * `prisma.$transaction` as the record that caused them (expense
 * create/update/delete), so a failed write can never leave a balance and its
 * ledger entry out of sync.
 */

type TxClient = Prisma.TransactionClient;

/** Fetches an org's account by type, lazily creating it (zero balance) if this is the first time it's referenced. */
export async function getOrCreateAccount(tx: TxClient, organizationId: string, type: AccountType) {
  const existing = await tx.financialAccount.findUnique({
    where: { organizationId_type: { organizationId, type } },
  });
  if (existing) return existing;

  return tx.financialAccount.create({
    data: {
      organizationId,
      type,
      name: ACCOUNT_TYPE_LABELS[type],
      startingBalance: 0,
      balance: 0,
    },
  });
}

/** Ensures all three accounts exist for an org. Used by the accounts settings page so all three always list, even before any expense has touched them. */
export async function ensureAccountsExist(organizationId: string) {
  for (const type of ACCOUNT_TYPES) {
    await getOrCreateAccount(prisma as unknown as TxClient, organizationId, type);
  }
}

async function recordAccountMovement(
  tx: TxClient,
  params: {
    accountId: string;
    type: AccountTransactionType;
    amount: number;
    expenseId?: string;
    description?: string;
    date?: Date;
    createdById: string;
  }
) {
  const isDebit = isDebitTransaction(params.type);

  let updated;
  if (isDebit) {
    // The balance check and the decrement are one statement on purpose.
    // Reading the balance, deciding, and then decrementing let two people
    // spend the same petty cash at once: at Postgres's default isolation both
    // read 100, both pass a check for 80, and the account lands at -60. The
    // `where` carries the check, so the second one matches no row.
    const { count } = await tx.financialAccount.updateMany({
      where: { id: params.accountId, balance: { gte: params.amount } },
      data: { balance: { decrement: params.amount } },
    });

    if (count === 0) {
      // Read it only now, and only to say how short it is.
      const account = await tx.financialAccount.findUniqueOrThrow({
        where: { id: params.accountId },
      });
      throw new InsufficientBalanceError(account.name, account.balance, params.amount);
    }

    updated = await tx.financialAccount.findUniqueOrThrow({
      where: { id: params.accountId },
    });
  } else {
    updated = await tx.financialAccount.update({
      where: { id: params.accountId },
      data: { balance: { increment: params.amount } },
    });
  }

  await tx.accountTransaction.create({
    data: {
      accountId: params.accountId,
      type: params.type,
      amount: params.amount,
      balanceAfter: updated.balance,
      expenseId: params.expenseId,
      description: params.description,
      date: params.date ?? new Date(),
      createdById: params.createdById,
    },
  });

  return updated;
}

/** Debits an account for a new/increased expense. Throws InsufficientBalanceError if it would overdraw. */
export async function debitAccountForExpense(
  tx: TxClient,
  params: { accountId: string; amount: number; expenseId?: string; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "expense_debit" });
}

/** Credits an account back for a deleted/reduced expense. Never blocked — crediting money back can't overdraw. */
export async function creditAccountForExpense(
  tx: TxClient,
  params: { accountId: string; amount: number; expenseId?: string; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "expense_credit" });
}

/**
 * Records money handed into (deposit) or taken out of (withdrawal) an account
 * outside of expenses/transfers, e.g. cash given to a supervisor for petty
 * cash. Withdrawals throw InsufficientBalanceError if they would overdraw.
 */
export async function recordManualMovement(params: {
  accountId: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string;
  createdById: string;
}) {
  return prisma.$transaction((tx) => recordAccountMovement(tx, params));
}

/**
 * Transfers funds between two accounts atomically (own transaction — this
 * isn't called from inside an expense write). Throws InsufficientBalanceError
 * if the source account can't cover it.
 */
export async function transferFunds(params: {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  description?: string;
  createdById: string;
}) {
  return prisma.$transaction(async (tx) => {
    await recordAccountMovement(tx, {
      accountId: params.fromAccountId,
      type: "transfer_out",
      amount: params.amount,
      description: params.description,
      createdById: params.createdById,
    });
    await recordAccountMovement(tx, {
      accountId: params.toAccountId,
      type: "transfer_in",
      amount: params.amount,
      description: params.description,
      createdById: params.createdById,
    });
  });
}
