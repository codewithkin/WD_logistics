/**
 * Notification tier system.
 *
 * Every notification type in the app is classified into one of 5 tiers,
 * which determines two things: which channels it goes out on, and which
 * roles actually see it. This exists specifically to stop admins getting
 * WhatsApp + email pings for every routine record creation — see git log
 * around this file's introduction for the "why".
 *
 * Tier 1 — Critical: money or safety at risk, needs a human NOW.
 *   Channels: WhatsApp + web push + in-app.
 *   Admin: always. Supervisor: always.
 *
 * Tier 2 — Important: needs attention soon, not an emergency.
 *   Channels: web push + in-app (+ WhatsApp only for the specific
 *   already-established exception below — document expiry).
 *   Admin: sparingly (only the types explicitly marked below).
 *   Supervisor: yes.
 *
 * Tier 3 — Standard: routine day-to-day operational events.
 *   Channels: web push + in-app. No email. No WhatsApp.
 *   Admin: no. Supervisor: yes. Staff: their own action's confirmation only.
 *
 * Tier 4 — Low priority: routine record housekeeping (edits, not creates).
 *   Channels: in-app only.
 *   Admin: no. Supervisor: yes (for the area they manage).
 *
 * Tier 5 — Informational/audit: no action needed, kept for the record.
 *   Channels: in-app only, not actively surfaced as a toast/push.
 *   Admin: no. Supervisor: no (available on-demand in the notification list).
 *
 * Email is deliberately absent from every tier's channel list above except
 * where a notification IS the primary deliverable (invoice reminders,
 * receipts, welcome emails) — those aren't "notifications" in this system,
 * they're transactional documents, and are untouched by this file.
 */

export type NotificationTier = 1 | 2 | 3 | 4 | 5;
export type NotificationChannel = "whatsapp" | "webPush" | "inApp" | "email";

/**
 * The app's roles, imported rather than redeclared.
 *
 * This file used to define its own three-role union that omitted "workshop",
 * which made it impossible to target a workshop user from the tier map at
 * all — the role could not be written down. That is why workshop assignment
 * notices had nowhere to go.
 */
export type { Role } from "@/lib/types";
import type { Role } from "@/lib/types";

export interface TierDefinition {
  tier: NotificationTier;
  channels: NotificationChannel[];
  roles: Role[];
}

/**
 * One entry per notification "key" used across the app (see
 * src/lib/notifications.ts and src/lib/whatsapp-notifications.ts call
 * sites). Keys not listed here default to tier 3 behavior — see
 * `getTierConfig` below.
 */
export const NOTIFICATION_TIERS: Record<string, TierDefinition> = {
  // ---- Tier 1: Critical ----
  invoice_overdue_severe: { tier: 1, channels: ["whatsapp", "webPush", "inApp"], roles: ["admin", "supervisor"] },
  account_insufficient_funds: { tier: 1, channels: ["whatsapp", "webPush", "inApp"], roles: ["admin", "supervisor"] },
  document_expired: { tier: 1, channels: ["whatsapp", "webPush", "inApp"], roles: ["admin", "supervisor"] },

  // ---- Tier 2: Important ----
  // Document expiry reminders keep WhatsApp even for admin — this was an
  // explicit, named requirement (advance + repeated WhatsApp reminders),
  // not a routine "X was created" ping, so it's the deliberate exception.
  document_expiry_advance: { tier: 2, channels: ["whatsapp", "webPush", "inApp"], roles: ["admin", "supervisor"] },
  invoice_fully_paid: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor"] },
  // Key must match tierKeyFor("edit_request", eventType) exactly — the
  // convenience functions in notifications.ts fire "created"/"updated"
  // events (never "pending"), so both are listed here explicitly. A
  // mismatched key here silently falls through to DEFAULT_TIER
  // (supervisor-only), which drops these for any org whose only
  // reviewer is admin — confirmed via scripts/_dev-feature-test.ts.
  edit_request_created: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor"] },
  edit_request_updated: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor"] },
  maintenance_request_fixed: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor"] },
  low_stock: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor"] },

  // Workshop assignment and its daily digest. These address named
  // individuals rather than a role broadcast (see sendUserNotification in
  // notifications.ts), but they still need an entry here so the channel list
  // and tier are declared in one place rather than assumed.
  maintenance_request_assigned: { tier: 2, channels: ["webPush", "inApp"], roles: ["workshop"] },
  maintenance_request_reassigned: { tier: 2, channels: ["webPush", "inApp"], roles: ["workshop"] },
  maintenance_request_updated: { tier: 3, channels: ["webPush", "inApp"], roles: ["workshop"] },
  maintenance_daily_digest: { tier: 2, channels: ["webPush", "inApp"], roles: ["workshop"] },

  // The approval loop. A request that nobody is told about is the single
  // most common way this feature has looked broken.
  edit_request_approved: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor", "staff"] },
  edit_request_rejected: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin", "supervisor", "staff"] },

  // Money moving, and work finishing.
  account_money_in: { tier: 1, channels: ["webPush", "inApp"], roles: ["admin"] },
  account_large_money_out: { tier: 1, channels: ["webPush", "inApp"], roles: ["admin"] },
  trip_completed: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin"] },
  trip_message_failed: { tier: 1, channels: ["webPush", "inApp"], roles: ["admin", "supervisor"] },
  invoice_overdue: { tier: 2, channels: ["webPush", "inApp"], roles: ["admin"] },
  user_invited: { tier: 3, channels: ["webPush", "inApp"], roles: ["admin"] },
  user_joined: { tier: 3, channels: ["webPush", "inApp"], roles: ["admin"] },

  // Sent to whoever pressed the button, so they can prove their own setup.
  test: { tier: 3, channels: ["webPush", "inApp"], roles: ["admin", "supervisor", "staff", "workshop"] },

  // ---- Tier 3: Standard (routine creations — admin excluded) ----
  driver_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  truck_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  trailer_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  customer_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  trip_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  invoice_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  payment_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },
  supplier_created: { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] },

  // ---- Tier 4: Low priority (edits, HR routine) ----
  employee_created: { tier: 4, channels: ["inApp"], roles: ["supervisor"] },
  driver_updated: { tier: 4, channels: ["inApp"], roles: ["supervisor"] },
  truck_updated: { tier: 4, channels: ["inApp"], roles: ["supervisor"] },
  trailer_updated: { tier: 4, channels: ["inApp"], roles: ["supervisor"] },
  customer_updated: { tier: 4, channels: ["inApp"], roles: ["supervisor"] },
  trip_updated: { tier: 4, channels: ["inApp"], roles: ["supervisor"] },

  // ---- Tier 5: Informational/audit (deletions, routine job runs) ----
  driver_deleted: { tier: 5, channels: ["inApp"], roles: [] },
  truck_deleted: { tier: 5, channels: ["inApp"], roles: [] },
  trailer_deleted: { tier: 5, channels: ["inApp"], roles: [] },
  customer_deleted: { tier: 5, channels: ["inApp"], roles: [] },
  trip_deleted: { tier: 5, channels: ["inApp"], roles: [] },
  employee_deleted: { tier: 5, channels: ["inApp"], roles: [] },
};

const DEFAULT_TIER: TierDefinition = { tier: 3, channels: ["webPush", "inApp"], roles: ["supervisor"] };

export function getTierConfig(key: string): TierDefinition {
  return NOTIFICATION_TIERS[key] ?? DEFAULT_TIER;
}

/** True if `role` should receive a notification of this key at all. */
export function shouldNotifyRole(key: string, role: Role): boolean {
  return getTierConfig(key).roles.includes(role);
}

/**
 * Every key a call site may use. A key that isn't here silently falls back to
 * DEFAULT_TIER, which is supervisor-only — so a typo doesn't error, it just
 * quietly stops delivering to the people who needed the message. This list
 * is what `assertTierKeyExists` checks against in development.
 */
export function isKnownTierKey(key: string): boolean {
  return key in NOTIFICATION_TIERS;
}

/**
 * Warns in development when a notification is sent under a key the tier map
 * has never heard of. It stays a warning rather than a throw: a mistyped key
 * should not take down the operation that triggered the notification.
 */
export function assertTierKeyExists(key: string): void {
  if (process.env.NODE_ENV === "production") return;
  if (isKnownTierKey(key)) return;
  console.warn(
    `[notifications] "${key}" is not in NOTIFICATION_TIERS, so it falls back ` +
      "to the supervisor-only default. Add it to src/lib/notification-tiers.ts.",
  );
}

export function channelsFor(key: string): NotificationChannel[] {
  return getTierConfig(key).channels;
}

/** Builds the lookup key for a generic entityType/eventType notification, e.g. "driver_created". */
export function tierKeyFor(entityType: string, eventType: string): string {
  return `${entityType}_${eventType}`;
}
