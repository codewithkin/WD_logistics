-- CreateTable
CREATE TABLE "trailer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "registrationNo" TEXT NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "type" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "licenseNumber" TEXT,
    "licenseExpiration" TIMESTAMP(3),
    "image" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assignedTruckId" TEXT,

    CONSTRAINT "trailer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trailer_assignedTruckId_key" ON "trailer"("assignedTruckId");

-- CreateIndex
CREATE INDEX "trailer_organizationId_status_idx" ON "trailer"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "trailer_organizationId_registrationNo_key" ON "trailer"("organizationId", "registrationNo");

-- AddForeignKey
ALTER TABLE "trailer" ADD CONSTRAINT "trailer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trailer" ADD CONSTRAINT "trailer_assignedTruckId_fkey" FOREIGN KEY ("assignedTruckId") REFERENCES "truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
