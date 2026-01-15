-- DropForeignKey
ALTER TABLE "payment" DROP CONSTRAINT "payment_invoiceId_fkey";

-- AlterTable
ALTER TABLE "payment" ALTER COLUMN "invoiceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
