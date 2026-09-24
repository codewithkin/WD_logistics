/**
 * Receives a file the assistant was sent over WhatsApp.
 *
 * Somebody photographs a fuel receipt at a pump and sends it to the bot. The
 * agent has the image; the app has the storage credentials and the database,
 * so the bytes come here as base64 and go straight to R2. The agent never
 * holds an R2 key.
 *
 * Deliberately narrow: it stores a file and returns its URL. Attaching that
 * URL to an expense is a separate, role-checked assistant operation, so an
 * upload on its own changes no records.
 */

import { NextRequest, NextResponse } from "next/server";
import { withAgentAuth } from "@/lib/agent-auth";
import { uploadToR2 } from "@/lib/r2";
import { prisma } from "@/lib/prisma";
import { toE164 } from "@/lib/whatsapp/trip-messages";

/** Images and PDFs only — a receipt is one or the other. */
const ALLOWED = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "application/pdf",
]);

/** WhatsApp caps media well below this; the bound is to stop a runaway body. */
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const denied = withAgentAuth(request);
  if (denied) return denied;

  const body = await request.json().catch(() => null);
  const phone: string | undefined = body?.phone;
  const base64: string | undefined = body?.base64;
  const mimeType: string | undefined = body?.mimeType;
  const filename: string = body?.filename || "receipt";

  if (!phone || !base64 || !mimeType) {
    return NextResponse.json(
      { success: false, error: "phone, base64 and mimeType are required" },
      { status: 400 },
    );
  }

  // Only somebody already on the contact list may put files in the bucket.
  const e164 = toE164(phone);
  const contact = e164
    ? await prisma.whatsAppContact.findFirst({
        where: { phone: e164, isActive: true },
        select: { id: true, name: true },
      })
    : null;

  if (!contact) {
    return NextResponse.json({ success: false, error: "Not authorised" }, { status: 403 });
  }

  if (!ALLOWED.has(mimeType.toLowerCase())) {
    return NextResponse.json({
      success: false,
      error: `I can only take photos and PDFs, not ${mimeType}.`,
    });
  }

  const buffer = Buffer.from(base64, "base64");
  if (buffer.length === 0) {
    return NextResponse.json({ success: false, error: "That file was empty." });
  }
  if (buffer.length > MAX_BYTES) {
    return NextResponse.json({
      success: false,
      error: "That file is too large. Send a smaller photo.",
    });
  }

  const result = await uploadToR2(buffer, filename, "receipts");
  if (!result.success || !result.url) {
    return NextResponse.json({
      success: false,
      error: result.error ?? "The file could not be stored.",
    });
  }

  return NextResponse.json({
    success: true,
    data: { url: result.url, sizeKb: Math.round(buffer.length / 1024) },
  });
}
