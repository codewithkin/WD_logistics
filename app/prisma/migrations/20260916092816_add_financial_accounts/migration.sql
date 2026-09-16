-- CreateTable
CREATE TABLE "financial_account" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startingBalance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_transaction" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "expenseId" TEXT,
    "description" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_transaction_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "expense_category" ADD COLUMN "defaultAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "financial_account_organizationId_type_key" ON "financial_account"("organizationId", "type");

-- CreateIndex
CREATE INDEX "account_transaction_accountId_date_idx" ON "account_transaction"("accountId", "date");

-- AddForeignKey
ALTER TABLE "financial_account" ADD CONSTRAINT "financial_account_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transaction" ADD CONSTRAINT "account_transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "financial_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_transaction" ADD CONSTRAINT "account_transaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_category" ADD CONSTRAINT "expense_category_defaultAccountId_fkey" FOREIGN KEY ("defaultAccountId") REFERENCES "financial_account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
