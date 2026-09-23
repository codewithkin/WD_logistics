-- DropForeignKey
ALTER TABLE "maintenance_request" DROP CONSTRAINT "maintenance_request_truckId_fkey";

-- AlterTable
ALTER TABLE "maintenance_request" ADD COLUMN     "assignedAt" TIMESTAMP(3),
ADD COLUMN     "assignedById" TEXT,
ADD COLUMN     "assignedToId" TEXT,
ADD COLUMN     "trailerId" TEXT,
ALTER COLUMN "truckId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "maintenance_request_organizationId_assignedToId_status_idx" ON "maintenance_request"("organizationId", "assignedToId", "status");

-- CreateIndex
CREATE INDEX "maintenance_request_organizationId_date_idx" ON "maintenance_request"("organizationId", "date");

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_trailerId_fkey" FOREIGN KEY ("trailerId") REFERENCES "trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "maintenance_request" ADD CONSTRAINT "maintenance_request_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A maintenance job targets exactly one vehicle: a truck or a trailer, never
-- both and never neither. Prisma can't express this, so it's a CHECK here.
ALTER TABLE "maintenance_request"
  ADD CONSTRAINT "maintenance_request_one_vehicle"
  CHECK (("truckId" IS NULL) <> ("trailerId" IS NULL));
