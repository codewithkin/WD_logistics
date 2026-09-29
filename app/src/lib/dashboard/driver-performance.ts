/**
 * How each driver did over a period: work assigned, work finished, what it
 * earned, and how long it took.
 *
 * **There is no on-time figure here, on purpose.** This used to report one,
 * counting a trip as on time if it ended within 24 hours of `scheduledDate`.
 * But `scheduledDate` is when the trip was due to *start*, and nothing in the
 * schema records when a load was due to *arrive* — so the measure was really
 * "finished within a day of setting off", which on a Mutare-to-Beira run is
 * never true. On real data it read 8% across the fleet and every driver came
 * out red. A metric that says every driver is failing is worse than no metric.
 *
 * What is here instead is measurable from what the records hold: how much of
 * the work put on a driver actually got done, what it earned, and how long a
 * trip takes them. If punctuality is wanted, `Trip` needs a planned delivery
 * date first — that is a question for the client, not something to infer.
 */

import prisma from "@/lib/prisma";
import { subMonths } from "date-fns";

export interface DriverPerformanceMetric {
  driverId: string;
  driverName: string;
  /** Trips assigned to them in the period, whatever became of them. */
  totalTrips: number;
  revenue: number;
  completedTrips: number;
  cancelledTrips: number;
  /** Completed trips as a share of those assigned, 0-100. */
  completionRate: number;
  /** Average revenue on a completed trip, or null with none completed. */
  revenuePerTrip: number | null;
  /**
   * Average days from setting off to finishing, over completed trips that
   * recorded both. Null when none did.
   */
  averageDays: number | null;
}

/**
 * Get driver performance metrics for the specified period
 * @param organizationId The organization to scope queries to
 * @param fromDate Start of the period (defaults to 3 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getDriverPerformanceData(
  organizationId: string,
  fromDate?: Date,
  toDate?: Date
): Promise<DriverPerformanceMetric[]> {
  const now = new Date();
  const endDate = toDate || now;
  const startDate = fromDate || subMonths(now, 3);

  const [drivers, trips] = await Promise.all([
    prisma.driver.findMany({
      where: { organizationId: organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    }),
    prisma.trip.findMany({
      where: {
        organizationId: organizationId,
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        driverId: true,
        status: true,
        revenue: true,
        startDate: true,
        endDate: true,
        scheduledDate: true,
      },
    }),
  ]);

  const DAY = 24 * 60 * 60 * 1000;

  const metrics: DriverPerformanceMetric[] = drivers.map((driver) => {
    const driverTrips = trips.filter((t) => t.driverId === driver.id);

    const totalTrips = driverTrips.length;
    const completedList = driverTrips.filter((t) => t.status === "completed");
    const completedTrips = completedList.length;
    const cancelledTrips = driverTrips.filter((t) => t.status === "cancelled").length;
    // Revenue counts finished work only, matching @/lib/metrics/revenue —
    // a scheduled or cancelled trip has earned nothing yet.
    const revenue = completedList.reduce((sum, t) => sum + (t.revenue || 0), 0);

    // Trips still scheduled count in the denominator: the question is what
    // share of the work put on this driver has been finished.
    const completionRate =
      totalTrips > 0 ? Math.round((completedTrips / totalTrips) * 100) : 0;

    const runs = completedList.filter(
      (t): t is typeof t & { startDate: Date; endDate: Date } =>
        t.startDate !== null && t.endDate !== null,
    );
    const averageDays =
      runs.length > 0
        ? Math.round(
            (runs.reduce(
              (sum, t) => sum + (t.endDate.getTime() - t.startDate.getTime()) / DAY,
              0,
            ) /
              runs.length) *
              10,
          ) / 10
        : null;

    return {
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`,
      totalTrips,
      revenue: Math.round(revenue * 100) / 100,
      completedTrips,
      cancelledTrips,
      completionRate,
      revenuePerTrip:
        completedTrips > 0 ? Math.round((revenue / completedTrips) * 100) / 100 : null,
      averageDays,
    };
  });

  // Sort by revenue (descending)
  return metrics.sort((a, b) => b.revenue - a.revenue);
}