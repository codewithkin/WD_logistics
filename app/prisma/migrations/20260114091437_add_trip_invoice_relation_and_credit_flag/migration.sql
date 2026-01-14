-- AlterTable
ALTER TABLE "invoice" ADD COLUMN     "isCredit" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tripId" TEXT,
ALTER COLUMN "dueDate" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "invoice_tripId_idx" ON "invoice"("tripId");

-- AddForeignKey
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
