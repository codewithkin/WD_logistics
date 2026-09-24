-- CreateTable
CREATE TABLE "whatsapp_session" (
    "session" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_session_pkey" PRIMARY KEY ("session")
);
