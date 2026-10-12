-- Two things the storeroom was missing.
--
-- 1. A managed label list. `inventory_item.category` was free text, so
--    "Brakes", "brakes" and "Brake Parts" were three categories and the list
--    page had no filter at all. The old column stays for now so the migration
--    is reversible and nothing still reading it breaks.
--
-- 2. A way for stock leaving the shelf to become a cost. Nothing in the
--    inventory flow created an expense, so a $20 brake pad fitted to a truck
--    contributed $0 to that truck's costs, its category breakdown and every
--    report. The movement now records which truck/trailer/trip/driver it went
--    to as a real reference rather than a sentence, and which expense it
--    posted, so a correction can reverse the cost instead of orphaning it.

CREATE TABLE "inventory_label" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_label_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inventory_label_organizationId_name_key" ON "inventory_label"("organizationId", "name");
CREATE INDEX "inventory_label_organizationId_sortOrder_idx" ON "inventory_label"("organizationId", "sortOrder");

ALTER TABLE "inventory_label" ADD CONSTRAINT "inventory_label_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inventory_item" ADD COLUMN "labelId" TEXT;
ALTER TABLE "inventory_item" ADD COLUMN "defaultExpenseCategoryId" TEXT;

ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_labelId_fkey"
    FOREIGN KEY ("labelId") REFERENCES "inventory_label"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_defaultExpenseCategoryId_fkey"
    FOREIGN KEY ("defaultExpenseCategoryId") REFERENCES "expense_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Turn the free-text categories already in use into labels, deduped
-- case-insensitively, and point each item at its own. Nothing is deleted:
-- `category` keeps its value.
INSERT INTO "inventory_label" ("id", "organizationId", "name", "updatedAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    "organizationId",
    min(btrim("category")) AS name,
    CURRENT_TIMESTAMP
FROM "inventory_item"
WHERE "category" IS NOT NULL AND btrim("category") <> ''
GROUP BY "organizationId", lower(btrim("category"));

UPDATE "inventory_item" AS item
SET "labelId" = label."id"
FROM "inventory_label" AS label
WHERE label."organizationId" = item."organizationId"
  AND lower(label."name") = lower(btrim(item."category"))
  AND item."category" IS NOT NULL;

ALTER TABLE "stock_movement" ADD COLUMN "truckId" TEXT;
ALTER TABLE "stock_movement" ADD COLUMN "trailerId" TEXT;
ALTER TABLE "stock_movement" ADD COLUMN "tripId" TEXT;
ALTER TABLE "stock_movement" ADD COLUMN "driverId" TEXT;
ALTER TABLE "stock_movement" ADD COLUMN "expenseId" TEXT;

CREATE UNIQUE INDEX "stock_movement_expenseId_key" ON "stock_movement"("expenseId");

ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_truckId_fkey"
    FOREIGN KEY ("truckId") REFERENCES "truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_trailerId_fkey"
    FOREIGN KEY ("trailerId") REFERENCES "trailer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_tripId_fkey"
    FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_driverId_fkey"
    FOREIGN KEY ("driverId") REFERENCES "driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movement" ADD CONSTRAINT "stock_movement_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Allocations gain the cost snapshot the movement beside them has carried
-- since September, and the expense they post.
ALTER TABLE "part_allocation" ADD COLUMN "unitCost" DOUBLE PRECISION;
ALTER TABLE "part_allocation" ADD COLUMN "expenseId" TEXT;

CREATE UNIQUE INDEX "part_allocation_expenseId_key" ON "part_allocation"("expenseId");
CREATE INDEX "part_allocation_truckId_allocatedAt_idx" ON "part_allocation"("truckId", "allocatedAt");

ALTER TABLE "part_allocation" ADD CONSTRAINT "part_allocation_expenseId_fkey"
    FOREIGN KEY ("expenseId") REFERENCES "expense"("id") ON DELETE SET NULL ON UPDATE CASCADE;
