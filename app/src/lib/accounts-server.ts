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

/**
 * Works an account's balance out from its ledger, instead of trusting the
 * running total.
 *
 * `FinancialAccount.balance` is a stored figure, incremented and decremented
 * as money moves. That is fine until something writes one half of a pair — a
 * balance moved with no entry, or an entry with no balance — and from then on
 * the figure is wrong for good, with nothing in the product able to repair it.
 * `recomputeInvoiceTotals` and `recomputeCustomerBalance` were both converted
 * away from running deltas for exactly this reason; this is the same move for
 * accounts.
 *
 * The truth is `startingBalance + every credit − every debit`. Returns what it
 * found so a caller can report a repair rather than performing one silently.
 */
export async function recomputeAccountBalance(
  accountId: string,
  client: TxClient = prisma as unknown as TxClient,
) {
  const account = await client.financialAccount.findUniqueOrThrow({
    where: { id: accountId },
    select: { id: true, name: true, startingBalance: true, balance: true },
  });

  const sums = await client.accountTransaction.groupBy({
    by: ["type"],
    where: { accountId },
    _sum: { amount: true },
  });

  let movement = 0;
  for (const row of sums) {
    const amount = row._sum.amount ?? 0;
    movement += isDebitTransaction(row.type) ? -amount : amount;
  }

  const correct = Math.round((account.startingBalance + movement) * 100) / 100;
  const previous = Math.round(account.balance * 100) / 100;
  // A cent of float is rounding, not drift.
  const changed = Math.abs(correct - previous) >= 0.005;

  if (changed) {
    await client.financialAccount.update({
      where: { id: accountId },
      data: { balance: correct },
    });
  }

  return { accountId, name: account.name, previous, balance: correct, changed };
}

/**
 * The three accounts, ready to put in a dropdown.
 *
 * Creates them if they are missing, because a form that offers no account is
 * how an expense ends up touching no balance — the defect the client reported.
 * Names only: a supervisor records what money went out and is not shown what
 * is left (ACCESS_CONTROL.md), so no balance travels to the browser with this.
 */
export async function listAccountOptions(organizationId: string) {
  await ensureAccountsExist(organizationId);
  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId },
    select: { id: true, name: true, type: true },
  });
  // Cash, Bank, Petty Cash — in the order the rest of the app lists them.
  return ACCOUNT_TYPES.flatMap((type) => accounts.filter((account) => account.type === type));
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
 * Money a customer has paid, arriving in an account.
 *
 * A customer payment used to be a `Payment` row and nothing else: cash
 * physically handed over never reached Cash, Bank or Petty Cash, so the three
 * balances could not reconcile with reality and the client reported "money in
 * was not affecting the balance of that account".
 *
 * Takes a transaction client, because the receipt and the balance it moves
 * have to land together — the same invariant the expense helpers above are
 * called under.
 */
export async function creditAccountForPayment(
  tx: TxClient,
  params: { accountId: string; amount: number; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "deposit" });
}

/**
 * Reversing a receipt: a payment deleted, reduced, or moved to another
 * account. Overdraws rather than refusing — the money has already gone back
 * to the customer, and refusing to record that would be the lie.
 */
export async function debitAccountForPaymentReversal(
  tx: TxClient,
  params: { accountId: string; amount: number; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "withdrawal", allowOverdraw: true });
}

/**
 * Money leaving an account to settle a supplier.
 *
 * Also missing until now: paying a supplier $5,000 moved the supplier's
 * balance and left Bank untouched. Overdraws rather than refusing, for the
 * same reason spending does — the payment has been made.
 */
export async function debitAccountForSupplierPayment(
  tx: TxClient,
  params: { accountId: string; amount: number; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "withdrawal", allowOverdraw: true });
}

/** Putting money back when a supplier payment is deleted or reduced. */
export async function creditAccountForSupplierReversal(
  tx: TxClient,
  params: { accountId: string; amount: number; description?: string; date?: Date; createdById: string }
) {
  return recordAccountMovement(tx, { ...params, type: "deposit" });
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
