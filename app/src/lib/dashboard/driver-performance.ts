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
  rating: number;
  efficiency: number; // percentage
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
    const completedTrips = driverTrips.filter((t) => t.status === "completed").length;
    const revenue = driverTrips.reduce((sum, t) => sum + (t.revenue || 0), 0);

    const onTimeTrips = driverTrips.filter((t) => {
      if (!t.endDate || !t.scheduledDate) return false;
      return t.endDate.getTime() <= t.scheduledDate.getTime() + buffer;
    }).length;

    const onTimePercentage = totalTrips > 0 ? (onTimeTrips / totalTrips) * 100 : 0;

    return {
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`,
      totalTrips,
      revenue: Math.round(revenue * 100) / 100,
      completedTrips,
      rating: 4.5, // Placeholder - can be enhanced with actual rating logic
      efficiency: Math.round(onTimePercentage),
    };
  });

  // Sort by revenue (descending)
  return metrics.sort((a, b) => b.revenue - a.revenue);
}