-- The outbound WhatsApp log learns whether a message actually arrived.
--
-- Sending was fire-and-forget: the trip creation path ignored the result and
-- always logged success, so a driver turning up saying "what WhatsApp
-- message?" could not be answered from inside the app. These columns are what
-- the trip page reads to say sent / delivered / read / failed-and-why.
--
-- Written by hand rather than generated: `updatedAt` needs a default for the
-- rows already in the table, and Prisma has no syntax for that on a required
-- column added to an existing table.
ALTER TABLE "notification"
  ADD COLUMN "organizationId" TEXT,
  ADD COLUMN "recipientName"  TEXT,
  ADD COLUMN "deliveredAt"    TIMESTAMP(3),
  ADD COLUMN "readAt"         TIMESTAMP(3),
  ADD COLUMN "waMessageId"    TEXT,
  ADD COLUMN "tripId"         TEXT,
  -- These two were already being written by api/agent/workflows, which had no
  -- columns to write them to — every call there failed silently.
  ADD COLUMN "responseAt"     TIMESTAMP(3),
  ADD COLUMN "responseData"   TEXT,
  ADD COLUMN "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Existing rows keep the trip id they were storing in metadata, so the
-- history on a trip page is not empty for anything sent before today.
UPDATE "notification"
SET "tripId" = "metadata"->>'tripId'
WHERE "metadata" ? 'tripId'
  AND EXISTS (SELECT 1 FROM "trip" WHERE "trip"."id" = "metadata"->>'tripId');

-- An ack from WhatsApp refers back to its own message id, so it has to be
-- unique for the lookup to be safe.
CREATE UNIQUE INDEX "notification_waMessageId_key" ON "notification"("waMessageId");
CREATE INDEX "notification_tripId_idx" ON "notification"("tripId");
CREATE INDEX "notification_organizationId_createdAt_idx" ON "notification"("organizationId", "createdAt");

ALTER TABLE "notification" ADD CONSTRAINT "notification_tripId_fkey"
  FOREIGN KEY ("tripId") REFERENCES "trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;
