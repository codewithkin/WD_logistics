import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Three-account accounting (Cash / Bank / Petty Cash).
 *
 * Revenue never touches these accounts by design — only expenses (debits)
 * and admin-initiated transfers between cash and petty cash (debit + credit)
 * do. All balance mutations here must run inside the same `prisma.$transaction`
 * as the record that caused them (expense create/update/delete), so a failed
 * write can never leave a balance and its ledger entry out of sync.
 *
 * AccountTransaction.type is one of: expense_debit, expense_credit,
 * transfer_out, transfer_in — direction is explicit in the type so ledger
 * reports don't have to infer inflow vs. outflow from context.
 */

export const ACCOUNT_TYPES = ["cash", "bank", "petty_cash"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  petty_cash: "Petty Cash",
};

export type AccountTransactionType = "expense_debit" | "expense_credit" | "transfer_out" | "transfer_in";

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

export class InsufficientBalanceError extends Error {
  constructor(accountName: string, balance: number, required: number) {
    super(
      `This would overdraw the ${accountName} account (balance: $${balance.toFixed(2)}, required: $${required.toFixed(2)})`
    );
    this.name = "InsufficientBalanceError";
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
  const isDebit = params.type === "expense_debit" || params.type === "transfer_out";

  if (isDebit) {
    const account = await tx.financialAccount.findUniqueOrThrow({ where: { id: params.accountId } });
    if (account.balance < params.amount) {
      throw new InsufficientBalanceError(account.name, account.balance, params.amount);
    }
  }

  const updated = await tx.financialAccount.update({
    where: { id: params.accountId },
    data: isDebit ? { balance: { decrement: params.amount } } : { balance: { increment: params.amount } },
  });

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
