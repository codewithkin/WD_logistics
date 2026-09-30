-- A document produced in a chat, parked for collection when WhatsApp will not
-- carry it. The token is the credential, so it is long, random and expires.
CREATE TABLE "document_handoff" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "forPhone" TEXT,
    "createdById" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "downloadedAt" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_handoff_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "document_handoff_token_key" ON "document_handoff"("token");
CREATE INDEX "document_handoff_organizationId_createdAt_idx" ON "document_handoff"("organizationId", "createdAt");
CREATE INDEX "document_handoff_expiresAt_idx" ON "document_handoff"("expiresAt");

ALTER TABLE "document_handoff" ADD CONSTRAINT "document_handoff_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
