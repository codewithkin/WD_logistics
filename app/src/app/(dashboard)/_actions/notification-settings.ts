"use server";

/**
 * Per-user notification settings and the delivery log behind them.
 *
 * These are deliberately not under Settings, which is admin-only. Push has to
 * be enabled by each person on each device, and most of the events that push
 * target supervisors and workshop users — neither of whom could reach the
 * Enable button at all, which is a large part of why "push notifications are
 * not working".
 */

import { prisma } from "@/lib/prisma";
import { requireAuth, assertRole } from "@/lib/session";
import { NOTIFICATION_TIERS } from "@/lib/notification-tiers";
import type { Role } from "@/lib/types";

export interface NotificationCategory {
  key: string;
  label: string;
  description: string;
  /** False when the user has muted push for it. */
  pushEnabled: boolean;
}

export interface DeliveryRow {
  id: string;
  title: string;
  status: string;
  statusCode: number | null;
  error: string | null;
  category: string | null;
  createdAt: Date;
}

/**
 * Human labels for the categories a person can mute. Only events a user can
 * meaningfully choose about are listed; audit-only tiers are not.
 */
const CATEGORY_LABELS: Record<string, { label: string; description: string }> = {
  maintenance_request_assigned: {
    label: "Jobs assigned to me",
    description: "When a workshop job is given to you.",
  },
  maintenance_request_updated: {
    label: "Changes to my jobs",
    description: "When someone edits a job you are working on.",
  },
  maintenance_request_fixed: {
    label: "Jobs closed",
    description: "When a job you raised is marked fixed.",
  },
  maintenance_daily_digest: {
    label: "My daily job list",
    description: "One summary each morning of what is due today.",
  },
  edit_request_created: {
    label: "New edit requests",
    description: "When someone asks an admin to approve a change.",
  },
  edit_request_approved: {
    label: "My requests approved",
    description: "When an admin accepts a change you asked for.",
  },
  edit_request_rejected: {
    label: "My requests rejected",
    description: "When an admin turns down a change you asked for.",
  },
  trip_created: {
    label: "New trips",
    description: "When a trip is scheduled.",
  },
  trip_completed: {
    label: "Trips completed",
    description: "When a trip is closed off.",
  },
  trip_message_failed: {
    label: "Driver messages that failed",
    description: "When a trip message could not reach the driver.",
  },
  payment_created: {
    label: "Payments recorded",
    description: "When money comes in against an invoice.",
  },
  invoice_overdue: {
    label: "Overdue invoices",
    description: "The daily check for invoices past their due date.",
  },
  account_money_in: {
    label: "Money into an account",
    description: "Deposits into Cash, Bank or Petty Cash.",
  },
  account_large_money_out: {
    label: "Large withdrawals",
    description: "Notable amounts taken out of an account.",
  },
  low_stock: {
    label: "Low stock",
    description: "When a part drops to its reorder level.",
  },
  document_expiry_advance: {
    label: "Documents expiring",
    description: "Licences, permits and insurance coming up for renewal.",
  },
  user_invited: {
    label: "People invited",
    description: "When someone is invited to the organisation.",
  },
};

/** The categories this role can actually receive, with the user's choices. */
export async function getNotificationSettings(): Promise<{
  categories: NotificationCategory[];
  recentDeliveries: DeliveryRow[];
}> {
  const session = await requireAuth();

  const [preferences, deliveries] = await Promise.all([
    prisma.notificationPreference.findMany({
      where: { userId: session.user.id },
    }),
    prisma.pushDelivery.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const muted = new Set(
    preferences.filter((p) => !p.pushEnabled).map((p) => p.category),
  );

  const categories = Object.entries(CATEGORY_LABELS)
    // Only offer switches for things this role is actually sent.
    .filter(([key]) => {
      const tier = NOTIFICATION_TIERS[key];
      return tier ? tier.roles.includes(session.role as Role) : false;
    })
    .map(([key, meta]) => ({
      key,
      label: meta.label,
      description: meta.description,
      pushEnabled: !muted.has(key),
    }));

  return {
    categories,
    recentDeliveries: deliveries.map((d) => ({
      id: d.id,
      title: d.title,
      status: d.status,
      statusCode: d.statusCode,
      error: d.error,
      category: d.category,
      createdAt: d.createdAt,
    })),
  };
}

/** Mute or unmute one category for the signed-in user. */
export async function setNotificationPreference(
  category: string,
  pushEnabled: boolean,
): Promise<{ success: true }> {
  const session = await requireAuth();

  // Only categories the app actually sends; an arbitrary string would
  // otherwise accumulate rows nothing ever reads.
  if (!(category in CATEGORY_LABELS)) {
    throw new Error(`Unknown notification category: ${category}`);
  }

  await prisma.notificationPreference.upsert({
    where: { userId_category: { userId: session.user.id, category } },
    create: {
      userId: session.user.id,
      organizationId: session.organizationId,
      category,
      pushEnabled,
    },
    update: { pushEnabled },
  });

  return { success: true };
}

/**
 * The organisation-wide delivery log, for an admin diagnosing "nobody is
 * getting notifications".
 */
export async function getPushDeliveryLog(limit = 50) {
  const session = await assertRole(["admin"]);

  const deliveries = await prisma.pushDelivery.findMany({
    where: { organizationId: session.organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { user: { select: { name: true, email: true } } },
  });

  const [subscriberCount, failureCount] = await Promise.all([
    prisma.pushSubscription.count({
      where: { user: { members: { some: { organizationId: session.organizationId } } } },
    }),
    prisma.pushDelivery.count({
      where: {
        organizationId: session.organizationId,
        status: { in: ["failed", "skipped"] },
        createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return {
    deliveries: deliveries.map((d) => ({
      id: d.id,
      user: d.user.name,
      email: d.user.email,
      title: d.title,
      status: d.status,
      statusCode: d.statusCode,
      error: d.error,
      category: d.category,
      createdAt: d.createdAt,
    })),
    subscriberCount,
    failuresLast7Days: failureCount,
  };
}
