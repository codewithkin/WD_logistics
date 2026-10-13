-- Which bill a supplier payment settles.
--
-- Recording a payment reduced what the supplier was owed, and ticking the same
-- bill as paid on the supplier's page reduced it again: the balance fell twice
-- for one payment, with nothing joining the two actions up. The link lets each
-- settlement be counted once.
--
-- Unique on both sides: one payment settles at most one bill, and a bill is
-- settled by at most one payment.

ALTER TABLE "supplier_payment" ADD COLUMN "expenseId" TEXT;

CREATE UNIQUE INDEX "supplier_payment_expenseId_key" ON "supplier_payment"("expenseId");

ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
