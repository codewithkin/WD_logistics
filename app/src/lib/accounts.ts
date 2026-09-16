/**
 * Three-account accounting (Cash / Bank / Petty Cash) — client-safe constants,
 * types, and the error class only. No Prisma import here on purpose: this
 * file is imported by client components (e.g. the Accounts page) for
 * ACCOUNT_TYPE_LABELS, and pulling in @/lib/prisma (and therefore the `pg`
 * driver, which needs Node builtins like `dns`) would break the client
 * bundle. Server-side mutations (debit/credit/transfer) live in
 * @/lib/accounts-server instead.
 */

export const ACCOUNT_TYPES = ["cash", "bank", "petty_cash"] as const;
export type AccountType = (typeof ACCOUNT_TYPES)[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: "Cash",
  bank: "Bank",
  petty_cash: "Petty Cash",
};

export type AccountTransactionType = "expense_debit" | "expense_credit" | "transfer_out" | "transfer_in";

export class InsufficientBalanceError extends Error {
  constructor(accountName: string, balance: number, required: number) {
    super(
      `This would overdraw the ${accountName} account (balance: $${balance.toFixed(2)}, required: $${required.toFixed(2)})`
    );
    this.name = "InsufficientBalanceError";
  }
}
