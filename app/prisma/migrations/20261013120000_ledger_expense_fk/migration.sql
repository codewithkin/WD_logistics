-- `account_transaction.expenseId` was a bare string with no foreign key, so
-- deleting an expense left ledger rows pointing at a record that no longer
-- existed. Any such rows are cleared first, then the reference becomes real.
--
-- SetNull, not Cascade: the money did move, and a ledger that loses entries
-- when an expense is tidied away is worse than one with an unattributed line.

UPDATE "account_transaction" AS t
SET "expenseId" = NULL
WHERE t."expenseId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "expense" e WHERE e."id" = t."expenseId");

CREATE INDEX "account_transaction_expenseId_idx" ON "account_transaction"("expenseId");

ALTER TABLE "account_transaction" ADD CONSTRAINT "account_transaction_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
