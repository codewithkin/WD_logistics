/**
 * The WhatsApp assistant's fair-use cap.
 *
 * The client pays a flat $5/month and each exchange costs roughly $0.012–0.015
 * of model spend, so the service needs a ceiling or a chatty month costs more
 * than it earns. This module is the one place that decides what "a message"
 * is, when the month turns over, and how many are allowed.
 *
 * **A message is one inbound message.** That is the honest unit: an inbound
 * message is what triggers the model call, the tool calls and the reply, so it
 * is what costs money. Replies are not counted separately — one question that
 * produces one answer is one message, which is also how a person would count
 * it, and the customer-facing wording says exactly that.
 *
 * **The month is a calendar month in Africa/Harare**, the clock the business
 * actually works to. Counting in UTC would roll the month over at 2am local
 * and hand two extra hours of the old month's quota to whoever was awake.
 */

import { prisma } from "@/lib/prisma";

/** Zimbabwe is UTC+2 all year — no daylight saving to track. */
const HARARE_OFFSET_MS = 2 * 60 * 60 * 1000;

/**
 * How many inbound messages an organisation gets per calendar month.
 *
 * Configurable without a deploy because this number is a commercial term, not
 * an engineering one: it was 120 in the first draft, is 200 now, and will be
 * renegotiated again. Set `WHATSAPP_MESSAGE_CAP` to change it.
 */
export const DEFAULT_MESSAGE_CAP = 200;

export function messageCap(): number {
  const configured = Number(process.env.WHATSAPP_MESSAGE_CAP);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : DEFAULT_MESSAGE_CAP;
}

/** Midnight on the 1st of the current Harare month, as a UTC instant. */
export function monthStart(now: Date = new Date()): Date {
  const harare = new Date(now.getTime() + HARARE_OFFSET_MS);
  return new Date(
    Date.UTC(harare.getUTCFullYear(), harare.getUTCMonth(), 1) - HARARE_OFFSET_MS,
  );
}

/** Midnight on the 1st of the next Harare month — when the count resets. */
export function monthEnd(now: Date = new Date()): Date {
  const harare = new Date(now.getTime() + HARARE_OFFSET_MS);
  return new Date(
    Date.UTC(harare.getUTCFullYear(), harare.getUTCMonth() + 1, 1) - HARARE_OFFSET_MS,
  );
}

export interface MessageUsage {
  /** Inbound messages so far this month. */
  used: number;
  limit: number;
  /** Never negative, even if the count somehow overshot. */
  remaining: number;
  /** True once the cap is reached: the assistant answers nothing at all. */
  blocked: boolean;
  /** ISO instant the count resets. */
  resetsAt: string;
  /** "1 October", for the sentence shown to an admin. */
  resetsOn: string;
}

export async function monthlyUsage(
  organizationId: string,
  now: Date = new Date(),
): Promise<MessageUsage> {
  const used = await prisma.whatsAppMessage.count({
    where: {
      organizationId,
      direction: "inbound",
      createdAt: { gte: monthStart(now) },
    },
  });

  return describeUsage(used, now);
}

/** The same shape, from a count already in hand. */
export function describeUsage(used: number, now: Date = new Date()): MessageUsage {
  const limit = messageCap();
  const resets = monthEnd(now);

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    blocked: used >= limit,
    resetsAt: resets.toISOString(),
    resetsOn: resets.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      timeZone: "Africa/Harare",
    }),
  };
}
