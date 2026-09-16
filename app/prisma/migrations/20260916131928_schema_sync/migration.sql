-- AlterTable
ALTER TABLE "driver" ADD COLUMN     "defenseCertificateExpiration" TIMESTAMP(3),
ADD COLUMN     "internationalDrivingPermitExpiration" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "inventory_item" ADD COLUMN     "unit" TEXT;

-- AlterTable
ALTER TABLE "truck" ADD COLUMN     "certificateOfFitnessExpiration" TIMESTAMP(3),
ADD COLUMN     "crossBorderInsuranceExpiration" TIMESTAMP(3),
ADD COLUMN     "crossBorderPermitExpiration" TIMESTAMP(3),
ADD COLUMN     "vehicleLicenseExpiration" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "push_subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "push_subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "push_subscription_endpoint_key" ON "push_subscription"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscription_userId_idx" ON "push_subscription"("userId");

-- AddForeignKey
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
