/*
  Warnings:

  - You are about to drop the column `address` on the `driver` table. All the data in the column will be lost.
  - You are about to drop the column `dateOfBirth` on the `driver` table. All the data in the column will be lost.
  - You are about to drop the column `licenseExpiry` on the `driver` table. All the data in the column will be lost.
  - You are about to drop the column `chassisNumber` on the `truck` table. All the data in the column will be lost.
  - You are about to drop the column `engineNumber` on the `truck` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "driver" DROP COLUMN "address",
DROP COLUMN "dateOfBirth",
DROP COLUMN "licenseExpiry";

-- AlterTable
ALTER TABLE "expense_category" ADD COLUMN     "isDriver" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "truck" DROP COLUMN "chassisNumber",
DROP COLUMN "engineNumber";

-- CreateTable
CREATE TABLE "driver_expense" (
    "id" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,

    CONSTRAINT "driver_expense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "driver_expense_driverId_expenseId_key" ON "driver_expense"("driverId", "expenseId");

-- AddForeignKey
ALTER TABLE "driver_expense" ADD CONSTRAINT "driver_expense_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_expense" ADD CONSTRAINT "driver_expense_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;
