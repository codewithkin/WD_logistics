/**
 * Fleet Utilization API Route
 * 
 * Fetches truck utilization data showing how many trucks are active,
 * in service, in repair, or inactive.
 */

import prisma from "@/lib/prisma";

export interface FleetUtilizationData {
  status: string;
  count: number;
  percentage: number;
  color: string;
}

/**
 * Get fleet utilization by truck status
 * @param organizationId The organization to scope queries to
 */
export async function getFleetUtilizationData(organizationId: string): Promise<FleetUtilizationData[]> {
  // Get truck counts by status
  const trucks = await prisma.truck.groupBy({
    by: ["status"],
    where: { organizationId: organizationId },
    _count: true,
  });

  // Calculate total
  const total = trucks.reduce((sum, t) => sum + t._count, 0);

  // Map to chart format with colors
  const statusMap: Record<string, { label: string; color: string }> = {
    active: { label: "Active", color: "#10b981" },
    in_service: { label: "In Service", color: "#3b82f6" },
    in_repair: { label: "In Repair", color: "#f59e0b" },
    inactive: { label: "Inactive", color: "#6b7280" },
  };

  const data: FleetUtilizationData[] = trucks.map((truck) => {
    const statusInfo = statusMap[truck.status] || { label: truck.status, color: "#9ca3af" };
    return {
      status: statusInfo.label,
      count: truck._count,
      percentage: total > 0 ? (truck._count / total) * 100 : 0,
      color: statusInfo.color,
    };
  });

  return data.sort((a, b) => b.count - a.count);
}
