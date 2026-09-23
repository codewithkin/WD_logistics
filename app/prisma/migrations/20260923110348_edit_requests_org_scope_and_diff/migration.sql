-- Edit requests become a real approve/reject flow.
--
-- Three things this adds that Prisma cannot express on its own, so do not
-- regenerate this file without re-reading it:
--   1. organizationId is backfilled from the requester's membership before
--      the NOT NULL constraint goes on — the column is required, and the
--      generated migration would have failed on any existing row.
--   2. A partial unique index allowing at most one *pending* request per
--      record, which Prisma has no syntax for.
--   3. `action` defaults to 'update', which is what every existing row was.

-- AlterTable: nullable first, so existing rows survive the backfill.
ALTER TABLE "edit_request" ADD COLUMN     "action" TEXT NOT NULL DEFAULT 'update',
ADD COLUMN     "appliedAt" TIMESTAMP(3),
ADD COLUMN     "applyError" TEXT,
ADD COLUMN     "entityLabel" TEXT,
ADD COLUMN     "organizationId" TEXT;

-- Backfill from whoever raised the request. A request whose requester has
-- since been removed from every organisation falls back to the only
-- organisation that exists (this deployment is single-org by design).
UPDATE "edit_request" er
SET "organizationId" = m."organizationId"
FROM "member" m
WHERE m."userId" = er."requestedById"
  AND er."organizationId" IS NULL;

UPDATE "edit_request"
SET "organizationId" = (SELECT "id" FROM "organization" ORDER BY "createdAt" ASC LIMIT 1)
WHERE "organizationId" IS NULL;

-- Anything still unattributable has no organisation to belong to and cannot
-- be approved safely; there is nothing to keep.
DELETE FROM "edit_request" WHERE "organizationId" IS NULL;

ALTER TABLE "edit_request" ALTER COLUMN "organizationId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "edit_request_organizationId_status_idx" ON "edit_request"("organizationId", "status");

-- CreateIndex
CREATE INDEX "edit_request_entityType_entityId_idx" ON "edit_request"("entityType", "entityId");

-- At most one pending request per record. Two people editing the same truck
-- would otherwise queue two diffs against the same original snapshot, and
-- approving both would silently apply the older one on top of the newer.
CREATE UNIQUE INDEX "edit_request_one_pending_per_entity"
  ON "edit_request" ("entityType", "entityId")
  WHERE "status" = 'pending';

-- AddForeignKey
ALTER TABLE "edit_request" ADD CONSTRAINT "edit_request_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
