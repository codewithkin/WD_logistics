/**
 * Native web push — sent to a user's subscribed browsers and devices (see the
 * PushSubscription model, /api/push/subscribe and public/sw.js). Independent
 * of WhatsApp and email; notification-tiers.ts decides which channels a given
 * notification type uses at all.
 *
 * Everything here is written down. Push used to fail silently in three
 * different ways — missing VAPID keys, a revoked subscription, a rejected
 * payload — and all three produced identical nothing, which is why "push
 * isn't working" could not be diagnosed from inside the app. Every attempt
 * now writes a PushDelivery row carrying the push service's own status code,
 * and that log is what the notification dialog and the admin table read.
 */

import webpush from "web-push";
import { prisma } from "@/lib/prisma";

/**
 * The public key is read at *runtime*, not baked in at build time.
 *
 * `NEXT_PUBLIC_*` values are substituted during `next build`, and the
 * Dockerfile declares `ARG NEXT_PUBLIC_VAPID_PUBLIC_KEY=""` — so unless the
 * key was passed as a build arg, every production image shipped with an
 * empty one and subscribing failed before it started. Reading
 * `VAPID_PUBLIC_KEY` from the process environment means the build no longer
 * matters; see /api/push/public-key, which is how the browser gets it.
 */
export function getVapidPublicKey(): string | undefined {
  return process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
}

const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

/** Why push is unavailable, in words an admin can act on. */
export function pushConfigurationProblem(): string | null {
  if (!getVapidPublicKey()) {
    return "VAPID_PUBLIC_KEY is not set on the server, so browsers cannot subscribe.";
  }
  if (!VAPID_PRIVATE_KEY) {
    return "VAPID_PRIVATE_KEY is not set on the server, so notifications cannot be signed.";
  }
  if (VAPID_SUBJECT === "mailto:admin@example.com") {
    // Not fatal, but Apple rejects placeholder subjects, so an iOS user would
    // see this as "push works everywhere except my phone".
    return null;
  }
  return null;
}

let configured = false;
let warnedAtBoot = false;

function ensureConfigured(): boolean {
  if (configured) return true;

  const publicKey = getVapidPublicKey();
  if (!publicKey || !VAPID_PRIVATE_KEY) {
    if (!warnedAtBoot) {
      warnedAtBoot = true;
      console.warn(
        "[push] Web push is disabled: set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY. " +
          "Generate a pair with `bunx web-push generate-vapid-keys`.",
      );
    }
    return false;
  }

  if (VAPID_SUBJECT === "mailto:admin@example.com" && !warnedAtBoot) {
    warnedAtBoot = true;
    console.warn(
      "[push] VAPID_SUBJECT is still the placeholder mailto:admin@example.com. " +
        "Apple's push service rejects placeholder subjects — set a real contact address.",
    );
  }

  webpush.setVapidDetails(VAPID_SUBJECT, publicKey, VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  /** Groups related notifications so a new one replaces the old. */
  tag?: string;
  /** notification-tiers key; used for the per-user mute switches. */
  category?: string;
  organizationId?: string;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Set when nothing was attempted, explaining why. */
  skipped?: string;
}

/**
 * Has this user muted the category?
 *
 * Absence of a row means "on" — the default is everything the tier map says
 * this role should receive, and a preference row only ever turns something
 * off.
 */
async function isMuted(userId: string, category?: string): Promise<boolean> {
  if (!category) return false;
  const preference = await prisma.notificationPreference.findUnique({
    where: { userId_category: { userId, category } },
    select: { pushEnabled: true },
  });
  return preference ? !preference.pushEnabled : false;
}

async function logDelivery(entry: {
  userId: string;
  organizationId?: string;
  subscriptionId?: string;
  payload: PushPayload;
  status: "sent" | "failed" | "skipped";
  statusCode?: number;
  error?: string;
}) {
  // A logging failure must never take down the operation that triggered the
  // notification, so this swallows its own errors.
  await prisma.pushDelivery
    .create({
      data: {
        userId: entry.userId,
        organizationId: entry.organizationId ?? entry.payload.organizationId,
        subscriptionId: entry.subscriptionId,
        title: entry.payload.title,
        body: entry.payload.body,
        url: entry.payload.url,
        category: entry.payload.category,
        status: entry.status,
        statusCode: entry.statusCode,
        error: entry.error,
      },
    })
    .catch((error) => {
      console.error("[push] could not write delivery log:", error);
    });
}

/**
 * Send to every device a user has subscribed on.
 *
 * Subscriptions the push service reports as gone (404/410) are pruned — a
 * stale one otherwise fails forever on every future send.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<PushResult> {
  if (!ensureConfigured()) {
    const reason =
      pushConfigurationProblem() ?? "Web push is not configured on the server.";
    await logDelivery({ userId, payload, status: "skipped", error: reason });
    return { sent: 0, failed: 0, skipped: reason };
  }

  if (await isMuted(userId, payload.category)) {
    // Deliberately not logged as a failure: the user asked for this.
    return { sent: 0, failed: 0, skipped: "muted by the user" };
  }

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    const reason =
      "This user has not enabled push notifications on any device yet.";
    await logDelivery({ userId, payload, status: "skipped", error: reason });
    return { sent: 0, failed: 0, skipped: reason };
  }

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({
            title: payload.title,
            body: payload.body,
            url: payload.url,
            tag: payload.tag,
          }),
        );
        sent++;
        await logDelivery({
          userId,
          subscriptionId: sub.id,
          payload,
          status: "sent",
        });
      } catch (error) {
        failed++;
        const statusCode = (error as { statusCode?: number }).statusCode;
        const message = describePushError(error, statusCode);

        await logDelivery({
          userId,
          subscriptionId: statusCode === 404 || statusCode === 410 ? undefined : sub.id,
          payload,
          status: "failed",
          statusCode,
          error: message,
        });

        if (statusCode === 404 || statusCode === 410) {
          // Expired, or revoked by the user or the browser.
          await prisma.pushSubscription
            .delete({ where: { id: sub.id } })
            .catch(() => {});
        } else {
          console.error("[push] send failed:", message);
        }
      }
    }),
  );

  return { sent, failed };
}

/** Turns a push service error into something an admin can act on. */
function describePushError(error: unknown, statusCode?: number): string {
  switch (statusCode) {
    case 400:
      return "The push service rejected the request (400) — usually a malformed VAPID key.";
    case 401:
    case 403:
      return "The push service rejected our credentials (401/403) — the VAPID key pair does not match the one this subscription was created with. Users must re-enable notifications after a key change.";
    case 404:
    case 410:
      return "This subscription is gone (the user cleared site data or revoked permission); it has been removed.";
    case 413:
      return "The notification payload was too large (413).";
    case 429:
      return "The push service is rate limiting us (429).";
    default:
      return error instanceof Error ? error.message : String(error);
  }
}

/** Send to several users at once (e.g. every admin). */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushResult> {
  const results = await Promise.all(
    userIds.map((id) => sendPushToUser(id, payload)),
  );
  return {
    sent: results.reduce((total, r) => total + r.sent, 0),
    failed: results.reduce((total, r) => total + r.failed, 0),
  };
}
