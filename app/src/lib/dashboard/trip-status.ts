/**
 * Trip Status Distribution API Route
 * 
 * Fetches count of trips by status for pie/donut chart visualization.
 */

import prisma from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";

export interface TripStatusData {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

/**
 * Get trip count by status
 * @param organizationId The organization to scope queries to
 */
export async function getTripStatusDistributionData(
  organizationId: string,
  startDate?: Date,
  endDate?: Date
): Promise<TripStatusData[]> {
  // Build where clause with optional date filter
  const whereClause: Prisma.TripWhereInput = { organizationId: organizationId };
  if (startDate && endDate) {
    whereClause.scheduledDate = {
      gte: startDate,
      lte: endDate,
    };
  }

  // Get trip counts by status
  const trips = await prisma.trip.groupBy({
    by: ["status"],
    where: whereClause,
    _count: true,
  });

  // Calculate total
  const total = trips.reduce((sum, t) => sum + t._count, 0);

  // Map to chart format with colors
  const statusMap: Record<string, { label: string; color: string }> = {
    scheduled: { label: "Scheduled", color: "#3b82f6" },
    in_progress: { label: "In Progress", color: "#f59e0b" },
    completed: { label: "Completed", color: "#10b981" },
    cancelled: { label: "Cancelled", color: "#ef4444" },
  };

  const data: TripStatusData[] = trips.map((trip) => {
    const statusInfo = statusMap[trip.status] || { label: trip.status, color: "#9ca3af" };
    return {
      status: statusInfo.label,
      count: trip._count,
      percentage: total > 0 ? (trip._count / total) * 100 : 0,
      color: statusInfo.color,
    };
  });

  return data.sort((a, b) => b.count - a.count);
}
