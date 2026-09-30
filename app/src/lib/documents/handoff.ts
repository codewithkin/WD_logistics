import "server-only";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Parking a document somebody asked for in a chat, so a failed send is not a
 * lost report.
 *
 * The assistant produces a report and the agent sends it as a WhatsApp
 * document. That send goes through the browser whatsapp-web.js drives, and it
 * gives up on anything large — which is how "it generates reports but cannot
 * send them" happens. The work is already done at that point, so the file is
 * parked here and the chat carries a link instead.
 *
 * The link is the credential. Nobody in a yard is going to sign in to read a
 * PDF on a phone, so the token is 32 random bytes, it expires, and every
 * collection is recorded against the number it was made for.
 */

/** Long enough that guessing is not a strategy. */
const TOKEN_BYTES = 32;

/**
 * A day. Long enough to survive a night shift and a flat battery, short
 * enough that a forwarded link is not a standing door into the accounts.
 */
const DEFAULT_TTL_HOURS = 24;

export interface StashedDocument {
  token: string;
  url: string;
  filename: string;
  sizeKb: number;
  expiresAt: Date;
}

/**
 * Where the link points.
 *
 * The app's own public URL, because the person opening it is on a phone
 * outside the network. Falls back to localhost so a developer sees something
 * that works rather than "undefined/d/…".
 */
export function appBaseUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.APP_URL ??
    process.env.BETTER_AUTH_URL;
  return (configured ?? "http://localhost:3000").replace(/\/+$/, "");
}

export async function stashDocument(params: {
  organizationId: string;
  filename: string;
  mimeType: string;
  /** The document itself, base64 as every generator returns it. */
  base64: string;
  forPhone?: string | null;
  createdById?: string | null;
  ttlHours?: number;
}): Promise<StashedDocument> {
  const data = Buffer.from(params.base64, "base64");
  const token = randomBytes(TOKEN_BYTES).toString("base64url");
  const expiresAt = new Date(
    Date.now() + (params.ttlHours ?? DEFAULT_TTL_HOURS) * 60 * 60 * 1000,
  );

  await prisma.documentHandoff.create({
    data: {
      organizationId: params.organizationId,
      token,
      filename: params.filename,
      mimeType: params.mimeType,
      data,
      sizeBytes: data.length,
      forPhone: params.forPhone ?? null,
      createdById: params.createdById ?? null,
      expiresAt,
    },
  });

  // Yesterday's links, swept on the way past rather than by a cron nobody
  // remembers to schedule. These rows hold whole documents.
  await prisma.documentHandoff
    .deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .catch(() => {});

  return {
    token,
    url: `${appBaseUrl()}/d/${token}`,
    filename: params.filename,
    sizeKb: Math.round(data.length / 1024),
    expiresAt,
  };
}

export type CollectResult =
  | { ok: true; filename: string; mimeType: string; data: Buffer }
  | { ok: false; reason: "missing" | "expired" };

/** Hand the file over, and record that it was collected. */
export async function collectDocument(token: string): Promise<CollectResult> {
  const row = await prisma.documentHandoff.findUnique({ where: { token } });
  if (!row) return { ok: false, reason: "missing" };
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "expired" };
  }

  await prisma.documentHandoff.update({
    where: { id: row.id },
    data: { downloadedAt: new Date(), downloadCount: { increment: 1 } },
  });

  return {
    ok: true,
    filename: row.filename,
    mimeType: row.mimeType,
    data: Buffer.from(row.data),
  };
}
