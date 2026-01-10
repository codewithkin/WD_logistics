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
import { db } from "@/lib/prisma";
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
 * Get driver performance metrics
 */
export async function getDriverPerformanceData(): Promise<DriverPerformanceMetric[]> {
  const user = await requireRole(["admin", "supervisor"]);
  const organization = user.organizationId;

  // Get all drivers
  const drivers = await db.driver.findMany({
    where: { organizationId: organization },
    select: {
      id: true,
      name: true,
      trips: true,
    },
  });

  // Get metrics for each driver
  const metrics: DriverPerformanceMetric[] = [];
  const threeMonthsAgo = subMonths(new Date(), 3);

  for (const driver of drivers) {
    // Get trips in last 3 months
    const trips = await db.trip.findMany({
      where: {
        driverId: driver.id,
        organizationId: organization,
        scheduledDate: {
          gte: threeMonthsAgo,
        },
      },
      select: {
        id: true,
        status: true,
        revenue: true,
        actualEndDate: true,
        scheduledDate: true,
      },
    });

    const totalTrips = trips.length;
    const completedTrips = trips.filter((t) => t.status === "completed").length;
    const revenue = trips.reduce((sum, t) => sum + (t.revenue || 0), 0);

    // Calculate on-time percentage (trips where actualEndDate <= scheduledDate + buffer)
    const onTimeTrips = trips.filter((t) => {
      if (!t.actualEndDate || !t.scheduledDate) return false;
      const buffer = 24 * 60 * 60 * 1000; // 24 hour buffer
      return t.actualEndDate.getTime() <= t.scheduledDate.getTime() + buffer;
    }).length;

    const onTimePercentage = totalTrips > 0 ? (onTimeTrips / totalTrips) * 100 : 0;

    metrics.push({
      driverId: driver.id,
      driverName: driver.name,
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
