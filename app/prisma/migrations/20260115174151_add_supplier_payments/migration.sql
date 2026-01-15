-- CreateTable
CREATE TABLE "supplier_payment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "method" TEXT NOT NULL,
    "customMethod" TEXT,
    "reference" TEXT,
    "description" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "supplier_payment_organizationId_paymentDate_idx" ON "supplier_payment"("organizationId", "paymentDate");

-- CreateIndex
CREATE INDEX "supplier_payment_supplierId_idx" ON "supplier_payment"("supplierId");

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment" ADD CONSTRAINT "supplier_payment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
