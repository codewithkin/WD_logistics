-- CreateTable
CREATE TABLE "user_notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isDismissed" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_notification_userId_isRead_isDismissed_idx" ON "user_notification"("userId", "isRead", "isDismissed");

-- CreateIndex
CREATE INDEX "user_notification_organizationId_createdAt_idx" ON "user_notification"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_notification" ADD CONSTRAINT "user_notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
