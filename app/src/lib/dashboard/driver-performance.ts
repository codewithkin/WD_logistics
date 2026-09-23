/**
 * Driver Performance API Route
 *
 * Fetches driver metrics for heat map/table visualization:
 * - Total trips
 * - Revenue generated
 * - Average rating
 * - On-time percentage
 */

import prisma from "@/lib/prisma";
import { subMonths } from "date-fns";

export interface DriverPerformanceMetric {
  driverId: string;
  driverName: string;
  totalTrips: number;
  revenue: number;
  completedTrips: number;
  /** Completed trips that finished by their scheduled date (+24h). */
  onTimeTrips: number;
  /** onTimeTrips as a share of completed trips, 0-100. */
  efficiency: number;
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
        endDate: true,
        scheduledDate: true,
      },
    }),
  ]);

  // Calculate on-time buffer (trips where endDate <= scheduledDate + buffer)
  const buffer = 24 * 60 * 60 * 1000; // 24 hour buffer

  const metrics: DriverPerformanceMetric[] = drivers.map((driver) => {
    const driverTrips = trips.filter((t) => t.driverId === driver.id);

    const totalTrips = driverTrips.length;
    const completedList = driverTrips.filter((t) => t.status === "completed");
    const completedTrips = completedList.length;
    // Revenue counts finished work only, matching @/lib/metrics/revenue —
    // a scheduled or cancelled trip has earned nothing yet.
    const revenue = completedList.reduce((sum, t) => sum + (t.revenue || 0), 0);

    const onTimeTrips = completedList.filter((t) => {
      if (!t.endDate || !t.scheduledDate) return false;
      return t.endDate.getTime() <= t.scheduledDate.getTime() + buffer;
    }).length;

    // Share of *completed* trips that landed on time. Dividing by every trip,
    // including ones still scheduled, made a busy driver look worse the more
    // work was booked ahead of them.
    const onTimePercentage = completedTrips > 0 ? (onTimeTrips / completedTrips) * 100 : 0;

    return {
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`,
      totalTrips,
      revenue: Math.round(revenue * 100) / 100,
      completedTrips,
      onTimeTrips,
      efficiency: Math.round(onTimePercentage),
    };
  });

  // Sort by revenue (descending)
  return metrics.sort((a, b) => b.revenue - a.revenue);
}