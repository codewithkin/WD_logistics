-- CreateTable
CREATE TABLE "whatsapp_contact" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'readonly',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "userId" TEXT,
    "notes" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_contact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_message" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contactId" TEXT,
    "direction" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "toolCalls" JSONB,
    "didWrite" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_contact_phone_key" ON "whatsapp_contact"("phone");

-- CreateIndex
CREATE INDEX "whatsapp_contact_organizationId_isActive_idx" ON "whatsapp_contact"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX "whatsapp_message_organizationId_createdAt_idx" ON "whatsapp_message"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "whatsapp_message_contactId_createdAt_idx" ON "whatsapp_message"("contactId", "createdAt");

-- AddForeignKey
ALTER TABLE "whatsapp_contact" ADD CONSTRAINT "whatsapp_contact_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_contact" ADD CONSTRAINT "whatsapp_contact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_message" ADD CONSTRAINT "whatsapp_message_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "whatsapp_contact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
