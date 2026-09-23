import "server-only";

/**
 * Telling a driver about a trip, and being able to prove it afterwards.
 *
 * The client's complaint, in their words: "so that we don't have a situation
 * where a driver comes in saying 'WhatsApp message? What WhatsApp message?'".
 * They were describing a real hole. Sending was fire-and-forget — the trip
 * creation path called the WhatsApp client, ignored what came back, and
 * logged a tick regardless. Nothing was written down, `driverNotified` was
 * never set, and a failure looked exactly like a success.
 *
 * Every attempt now writes a Notification row and moves it through
 * pending → sent → delivered → read, or to failed with a reason the office
 * can act on. `trip.driverNotified` is set only on a real send.
 */

import { prisma } from "@/lib/prisma";
import { notifyByTierKey } from "@/lib/notifications";

export type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

export interface SendOutcome {
  status: MessageStatus;
  notificationId: string;
  /** Present when the message could not be sent. */
  error?: string;
  /** Which number it actually went to — the office needs this to check. */
  recipientPhone?: string;
}

/**
 * Normalises a Zimbabwean number to E.164.
 *
 * Numbers get entered as 0772958986, 772958986, +263 77 295 8986 and
 * 263772958986. WhatsApp only accepts one of those, and the difference
 * between them was silently the difference between a delivered message and
 * nothing at all.
 */
export function toE164(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 0) return null;

  // Already country-coded.
  if (digits.startsWith("263")) return `+${digits}`;
  // Local trunk prefix.
  if (digits.startsWith("0")) return `+263${digits.slice(1)}`;
  // Bare subscriber number.
  if (digits.length === 9) return `+263${digits}`;
  // Anything else is presumed already international.
  return `+${digits}`;
}

/**
 * The number to message, preferring the dedicated WhatsApp field and falling
 * back to the phone number. Returns which one was used, because "we messaged
 * their office landline" is a real failure mode.
 */
export function driverWhatsAppNumber(driver: {
  whatsappNumber: string | null;
  phone: string | null;
}): { number: string; usedFallback: boolean } | null {
  const primary = toE164(driver.whatsappNumber);
  if (primary) return { number: primary, usedFallback: false };
  const fallback = toE164(driver.phone);
  if (fallback) return { number: fallback, usedFallback: true };
  return null;
}

/**
 * Sends a trip message and records what happened.
 *
 * Never throws: the agent being down must not stop a trip being created. The
 * caller gets an outcome it can surface, and the failure is recorded either
 * way.
 */
export async function sendTripMessage(params: {
  tripId: string;
  organizationId: string;
  driverId: string;
  driverName: string;
  phone: string;
  message: string;
  /** Distinguishes the first automatic send from a manual resend. */
  trigger?: "auto" | "manual";
}): Promise<SendOutcome> {
  // 1. Write the attempt down *before* trying, so a crash mid-send still
  //    leaves evidence that something was attempted.
  const notification = await prisma.notification.create({
    data: {
      organizationId: params.organizationId,
      tripId: params.tripId,
      type: "trip_assignment",
      recipientPhone: params.phone,
      recipientName: params.driverName,
      message: params.message,
      status: "pending",
      metadata: {
        driverId: params.driverId,
        trigger: params.trigger ?? "auto",
      },
    },
  });

  try {
    const result = await deliver(params.phone, params.message);

    if (!result.success) {
      await prisma.notification.update({
        where: { id: notification.id },
        data: { status: "failed", error: result.error },
      });
      await warnTheOffice(params, result.error);
      return {
        status: "failed",
        notificationId: notification.id,
        error: result.error,
        recipientPhone: params.phone,
      };
    }

    await prisma.$transaction([
      prisma.notification.update({
        where: { id: notification.id },
        data: {
          status: "sent",
          sentAt: new Date(),
          waMessageId: result.messageId ?? null,
        },
      }),
      // Only a real send counts. This used to be set regardless, or not at
      // all, depending on the path.
      prisma.trip.update({
        where: { id: params.tripId },
        data: { driverNotified: true, notifiedAt: new Date() },
      }),
    ]);

    return {
      status: "sent",
      notificationId: notification.id,
      recipientPhone: params.phone,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not reach the messaging service";
    await prisma.notification
      .update({
        where: { id: notification.id },
        data: { status: "failed", error: message },
      })
      .catch(() => {});
    await warnTheOffice(params, message);
    return {
      status: "failed",
      notificationId: notification.id,
      error: message,
      recipientPhone: params.phone,
    };
  }
}

/**
 * Hands the message to the agent, which owns the WhatsApp session in
 * production (the decision recorded in the plan: one bot, not two).
 *
 * Falls back to the app's own in-process client when no agent is configured,
 * so a local dev setup still works.
 */
async function deliver(
  phone: string,
  message: string,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const agentUrl = process.env.AGENT_URL;
  const apiKey = process.env.AGENT_API_KEY;

  if (agentUrl && apiKey) {
    try {
      const response = await fetch(`${agentUrl}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify({ to: phone, message }),
        // A hung agent must not hold a trip creation open.
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return {
          success: false,
          error:
            response.status === 503
              ? "The WhatsApp bot is not connected. Pair it under Settings, then resend."
              : `The messaging service returned ${response.status}. ${body}`.trim(),
        };
      }

      const data = (await response.json()) as {
        success?: boolean;
        messageId?: string;
        error?: string;
      };

      return data.success === false
        ? { success: false, error: data.error ?? "The message was rejected." }
        : { success: true, messageId: data.messageId };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error && error.name === "TimeoutError"
            ? "The messaging service did not respond in time."
            : "Could not reach the messaging service.",
      };
    }
  }

  // No agent configured — use the in-process client.
  const { sendWhatsAppMessage } = await import("@/lib/whatsapp");
  const result = await sendWhatsAppMessage(phone, message);
  return result.success
    ? { success: true }
    : { success: false, error: result.message };
}

/** A failed driver message is something the office has to know about. */
async function warnTheOffice(
  params: { organizationId: string; tripId: string; driverName: string },
  error?: string,
): Promise<void> {
  await notifyByTierKey({
    key: "trip_message_failed",
    organizationId: params.organizationId,
    title: "Driver message failed",
    message: `${params.driverName} was not told about their trip: ${error ?? "unknown error"}`,
    link: `/operations/trips/${params.tripId}`,
    entityType: "trip",
    entityId: params.tripId,
  }).catch(() => {
    // Never let a notification failure mask the original one.
  });
}

/** Every attempt made for a trip, newest first — what the trip page shows. */
export async function getTripMessages(tripId: string) {
  return prisma.notification.findMany({
    where: { tripId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      recipientPhone: true,
      recipientName: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      error: true,
      createdAt: true,
      metadata: true,
    },
  });
}

/**
 * Applies a WhatsApp delivery receipt.
 *
 * whatsapp-web.js ack levels: 1 sent to server, 2 delivered to device,
 * 3 read. Anything below 2 tells us nothing we didn't already know.
 */
export async function applyDeliveryAck(
  waMessageId: string,
  ack: number,
): Promise<{ applied: boolean }> {
  if (ack < 2) return { applied: false };

  const notification = await prisma.notification.findUnique({
    where: { waMessageId },
    select: { id: true, status: true },
  });
  if (!notification) return { applied: false };

  // Never move backwards: a late "delivered" ack must not undo a "read".
  if (notification.status === "read") return { applied: false };

  await prisma.notification.update({
    where: { id: notification.id },
    data:
      ack >= 3
        ? { status: "read", readAt: new Date(), deliveredAt: new Date() }
        : { status: "delivered", deliveredAt: new Date() },
  });

  return { applied: true };
}
