-- CreateTable
CREATE TABLE "driver_truck_assignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "startedById" TEXT,
    "endedById" TEXT,
    "endReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_truck_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "driver_truck_assignment_driverId_startDate_idx" ON "driver_truck_assignment"("driverId", "startDate");

-- CreateIndex
CREATE INDEX "driver_truck_assignment_truckId_startDate_idx" ON "driver_truck_assignment"("truckId", "startDate");

-- CreateIndex
CREATE INDEX "driver_truck_assignment_organizationId_startDate_idx" ON "driver_truck_assignment"("organizationId", "startDate");

-- AddForeignKey
ALTER TABLE "driver_truck_assignment" ADD CONSTRAINT "driver_truck_assignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_truck_assignment" ADD CONSTRAINT "driver_truck_assignment_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_truck_assignment" ADD CONSTRAINT "driver_truck_assignment_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "truck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_truck_assignment" ADD CONSTRAINT "driver_truck_assignment_startedById_fkey" FOREIGN KEY ("startedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_truck_assignment" ADD CONSTRAINT "driver_truck_assignment_endedById_fkey" FOREIGN KEY ("endedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A driver can have at most one open assignment, and so can a truck. Prisma
-- has no syntax for a partial unique index, so these are hand-added — do not
-- regenerate this file without re-adding them. Without the constraint, a
-- reassignment that failed halfway would leave two open rows and every
-- snapshot after it would double-count the overlap.
CREATE UNIQUE INDEX "driver_truck_assignment_one_open_per_driver"
  ON "driver_truck_assignment" ("driverId")
  WHERE "endDate" IS NULL;

CREATE UNIQUE INDEX "driver_truck_assignment_one_open_per_truck"
  ON "driver_truck_assignment" ("truckId")
  WHERE "endDate" IS NULL;
