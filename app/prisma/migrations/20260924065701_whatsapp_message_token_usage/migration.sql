-- AlterTable
ALTER TABLE "whatsapp_message" ADD COLUMN     "completionTokens" INTEGER,
ADD COLUMN     "costUsd" DOUBLE PRECISION,
ADD COLUMN     "promptTokens" INTEGER,
ADD COLUMN     "reasoningTokens" INTEGER;
