-- Which of the three accounts an expense was actually paid from.
--
-- Until now the only route from an expense to an account was the category's
-- default, so there was no way to record that one particular tyre came out of
-- petty cash — and when the defaults were missing, which they were out of the
-- box, no expense moved any balance at all. Null stays a real answer: stock
-- consumed from the storeroom was paid for when it was bought, and an unpaid
-- supplier bill has not left any account yet.

ALTER TABLE "expense" ADD COLUMN "accountId" TEXT;

CREATE INDEX "expense_accountId_idx" ON "expense"("accountId");

ALTER TABLE "expense" ADD CONSTRAINT "expense_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
