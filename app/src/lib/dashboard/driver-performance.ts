/**
 * Driver Performance API Route
 * 
 * Fetches driver metrics for heat map/table visualization:
 * - Total trips
 * - Revenue generated
 * - Average rating
 * - On-time percentage
 */

import { requireRole } from "@/lib/session";
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
 * @param fromDate Start of the period (defaults to 3 months ago)
 * @param toDate End of the period (defaults to now)
 */
export async function getDriverPerformanceData(
  fromDate?: Date,
  toDate?: Date
): Promise<DriverPerformanceMetric[]> {
  const user = await requireRole(["admin", "supervisor"]);
  const organization = user.organizationId;

  const now = new Date();
  const endDate = toDate || now;
  const startDate = fromDate || subMonths(now, 3);

  // Get all drivers
  const drivers = await prisma.driver.findMany({
    where: { organizationId: organization },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      trips: true,
    },
  });

  // Get metrics for each driver
  const metrics: DriverPerformanceMetric[] = [];

  for (const driver of drivers) {
    // Get trips in the specified period
    const trips = await prisma.trip.findMany({
      where: {
        driverId: driver.id,
        organizationId: organization,
        scheduledDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        revenue: true,
        endDate: true,
        scheduledDate: true,
      },
    });

    const totalTrips = trips.length;
    const completedTrips = trips.filter((t) => t.status === "completed").length;
    const revenue = trips.reduce((sum, t) => sum + (t.revenue || 0), 0);

    // Calculate on-time percentage (trips where endDate <= scheduledDate + buffer)
    const onTimeTrips = trips.filter((t) => {
      if (!t.endDate || !t.scheduledDate) return false;
      const buffer = 24 * 60 * 60 * 1000; // 24 hour buffer
      return t.endDate.getTime() <= t.scheduledDate.getTime() + buffer;
    }).length;

    const onTimePercentage = totalTrips > 0 ? (onTimeTrips / totalTrips) * 100 : 0;

    metrics.push({
      driverId: driver.id,
      driverName: `${driver.firstName} ${driver.lastName}`,
      totalTrips,
      revenue: Math.round(revenue * 100) / 100,
      completedTrips,
      rating: 4.5, // Placeholder - can be enhanced with actual rating logic
      efficiency: Math.round(onTimePercentage),
    });
  }

  // Sort by revenue (descending)
  return metrics.sort((a, b) => b.revenue - a.revenue);
}
