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
    /**
     * Let the account go negative rather than refusing.
     *
     * True for spending — money out and an expense paid from an account.
     * A supervisor cannot see balances any more (ACCESS_CONTROL.md, 30 Sep),
     * so refusing with "the Cash account only has $40" would hand them the
     * balance in an error message, and refusing without a figure would stop
     * a yard from paying for a tyre at six in the evening. The client chose
     * to let it through and tell the owner: the caller notifies an admin when
     * the balance it gets back is negative.
     *
     * False for a transfer between accounts, which is admin-only bookkeeping
     * rather than spending, and which an admin can see the balance for.
     */
    allowOverdraw?: boolean;
  }
) {
  const isDebit = isDebitTransaction(params.type);

  let updated;
  if (isDebit && !params.allowOverdraw) {
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
  } else if (isDebit) {
    updated = await tx.financialAccount.update({
      where: { id: params.accountId },
      data: { balance: { decrement: params.amount } },
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

/**
 * Debits an account for a new or increased expense.
 *
 * Overdraws rather than refusing, for the reason on `allowOverdraw` above —
 * an expense paid out of an account is spending, and the person recording it
 * may not be allowed to see what is in there. Returns the account, so the
 * caller can tell an admin when it has gone negative.
 */
export async function debitAccountForExpense(
  tx: TxClient,
  params: { accountId: string; amount: number; expenseId?: string; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "expense_debit", allowOverdraw: true });
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
 * outside of expenses and transfers — cash given to a supervisor for petty
 * cash, a note taken out to pay a tow truck.
 *
 * A withdrawal overdraws rather than being refused; the caller tells an admin
 * when the balance it gets back has gone negative. See `allowOverdraw`.
 */
export async function recordManualMovement(params: {
  accountId: string;
  type: "deposit" | "withdrawal";
  amount: number;
  description: string;
  createdById: string;
}) {
  return prisma.$transaction((tx) =>
    recordAccountMovement(tx, { ...params, allowOverdraw: true }),
  );
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
