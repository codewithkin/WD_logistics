-- Which of the three accounts a payment went into, or came out of.
--
-- Its absence was half of "money in was not affecting the balance": a customer
-- payment was a Payment row and nothing else, and a supplier payment moved
-- only the supplier's balance. Nullable, because rows written before this have
-- no answer and because recording that a payment happened without saying where
-- the money sits is a legitimate thing to mean.
ALTER TABLE "payment" ADD COLUMN "accountId" TEXT;
ALTER TABLE "supplier_payment" ADD COLUMN "accountId" TEXT;

CREATE INDEX "payment_accountId_idx" ON "payment"("accountId");
CREATE INDEX "supplier_payment_accountId_idx" ON "supplier_payment"("accountId");

ALTER TABLE "payment" ADD CONSTRAINT "payment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_accountId_fkey"
  FOREIGN KEY ("accountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
