/**
 * Cron: the workshop's daily job list.
 *
 * GET /api/cron/maintenance-digest — call once each morning in Harare time
 * (07:00 CAT is 05:00 UTC).
 *
 * Each workshop user gets one notification naming what is due today and what
 * has slipped, rather than a separate ping per job. This is the piece of the
 * "workshop sees their tasks for the day" requirement that needed working
 * push, which is why it lands with the push fixes rather than before them.
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";
import {
  UNFINISHED_STATUSES,
  startOfDayInHarare,
} from "@/app/(dashboard)/maintenance/_lib/status";

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (CRON_SECRET && authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStart = startOfDayInHarare();
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // Every unfinished job that is assigned to somebody. A job nobody owns is
    // the office's problem, not the workshop's, so it is not digested.
    const jobs = await prisma.maintenanceRequest.findMany({
      where: {
        status: { in: [...UNFINISHED_STATUSES] },
        assignedToId: { not: null },
        date: { lt: tomorrowStart },
      },
      select: {
        id: true,
        date: true,
        organizationId: true,
        assignedToId: true,
        truck: { select: { registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
      orderBy: { date: "asc" },
    });

    // Group by assignee so each person gets one message.
    const byUser = new Map<
      string,
      { organizationId: string; today: string[]; overdue: string[] }
    >();

    for (const job of jobs) {
      const userId = job.assignedToId!;
      const bucket =
        byUser.get(userId) ??
        { organizationId: job.organizationId, today: [], overdue: [] };

      const vehicle =
        job.truck?.registrationNo ??
        (job.trailer ? `${job.trailer.registrationNo} (trailer)` : "vehicle removed");

      if (job.date < todayStart) {
        bucket.overdue.push(vehicle);
      } else {
        bucket.today.push(vehicle);
      }
      byUser.set(userId, bucket);
    }

    let sent = 0;

    for (const [userId, bucket] of byUser) {
      const parts: string[] = [];
      if (bucket.today.length > 0) {
        parts.push(
          `${bucket.today.length} due today (${bucket.today.slice(0, 3).join(", ")}${
            bucket.today.length > 3 ? "…" : ""
          })`,
        );
      }
      if (bucket.overdue.length > 0) {
        parts.push(
          `${bucket.overdue.length} overdue (${bucket.overdue.slice(0, 3).join(", ")}${
            bucket.overdue.length > 3 ? "…" : ""
          })`,
        );
      }
      if (parts.length === 0) continue;

      await notifyUsers({
        userIds: [userId],
        organizationId: bucket.organizationId,
        entityType: "maintenance_request",
        entityId: "digest",
        title: "Your jobs today",
        message: parts.join(" · "),
        link: "/maintenance",
        category: "maintenance_daily_digest",
      });
      sent++;
    }

    return NextResponse.json({
      success: true,
      workersNotified: sent,
      jobsConsidered: jobs.length,
    });
  } catch (error) {
    console.error("[cron] maintenance digest failed:", error);
    return NextResponse.json(
      { success: false, error: "Failed to send the maintenance digest" },
      { status: 500 },
    );
  }
}
