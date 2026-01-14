import { z } from "zod";
import { trucksApi } from "../lib/api-client";

/**
 * Tool to list all trucks with optional filtering
 */
export const listTrucks = {
  definition: {
    name: "list_trucks",
    description: "List all trucks in the fleet with optional status filter. Use this to get an overview of available trucks.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID to filter trucks"),
      status: z
        .enum(["active", "in_service", "in_repair", "inactive", "decommissioned"])
        .optional()
        .describe("Filter by truck status"),
      limit: z.number().optional().default(20).describe("Maximum number of trucks to return"),
    }),
  },
  execute: async (params: { organizationId: string; status?: string; limit?: number }) => {
    const { organizationId, status } = params;
    
    try {
      const result = await trucksApi.list(organizationId, { status });
      return {
        trucks: result.trucks.map((truck) => ({
          id: truck.id,
          registrationNo: truck.registrationNo,
          model: truck.model,
          status: truck.status,
          capacity: truck.capacity,
          driverName: truck.driverName,
        })),
        total: result.total,
      };
    } catch (error) {
      console.error("Error listing trucks:", error);
      return { trucks: [], total: 0, error: "Failed to fetch trucks" };
    }
  },
};

/**
 * Tool to get detailed information about a specific truck
 */
export const getTruckDetails = {
  definition: {
    name: "get_truck_details",
    description: "Get detailed information about a specific truck including its driver, recent trips, and expenses.",
    inputSchema: z.object({
      truckId: z.string().optional().describe("The truck ID"),
      registrationNo: z.string().optional().describe("The truck registration number"),
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { truckId?: string; registrationNo?: string; organizationId: string }) => {
    const { truckId, organizationId } = params;

    if (!truckId) {
      return { truck: null };
    }

    try {
      const truck = await trucksApi.details(organizationId, truckId);
      return { truck };
    } catch (error) {
      console.error("Error getting truck details:", error);
      return { truck: null, error: "Failed to fetch truck details" };
    }
  },
};

/**
 * Tool to get truck performance metrics
 */
export const getTruckPerformance = {
  definition: {
    name: "get_truck_performance",
    description: "Get performance metrics for trucks including revenue, expenses, trip count, and profitability.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      truckId: z.string().optional().describe("Optional: specific truck ID to analyze"),
      startDate: z.string().optional().describe("Start date for analysis (ISO format)"),
      endDate: z.string().optional().describe("End date for analysis (ISO format)"),
    }),
  },
  execute: async (params: { organizationId: string; truckId?: string; startDate?: string; endDate?: string }) => {
    const { organizationId, truckId, startDate, endDate } = params;

    if (!truckId) {
      // For summary of all trucks, use the summary endpoint
      try {
        const summary = await trucksApi.summary(organizationId);
        return { 
          performance: [], 
          summary: {
            totalTrucks: summary.total,
            byStatus: summary.byStatus,
          }
        };
      } catch (error) {
        console.error("Error getting truck summary:", error);
        return { performance: [], summary: null, error: "Failed to fetch truck summary" };
      }
    }

    try {
      const performance = await trucksApi.performance(organizationId, truckId, startDate, endDate);
      return { 
        performance: [performance],
        summary: {
          totalTrucks: 1,
          totalRevenue: performance.totalRevenue,
          totalExpenses: performance.totalExpenses,
          totalProfit: performance.profit,
        }
      };
    } catch (error) {
      console.error("Error getting truck performance:", error);
      return { performance: [], summary: null, error: "Failed to fetch truck performance" };
    }
  },
};

/**
 * Tool to check truck availability
 */
export const checkTruckAvailability = {
  definition: {
    name: "check_truck_availability",
    description: "Check which trucks are available for trips on a specific date or date range.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      date: z.string().describe("The date to check availability (ISO format)"),
      endDate: z.string().optional().describe("Optional end date for range check"),
    }),
  },
  execute: async (params: { organizationId: string; date: string; endDate?: string }) => {
    const { organizationId, status } = params as { organizationId: string; status?: string };

    try {
      // Get all trucks and filter by active status
      const result = await trucksApi.list(organizationId, { status: "active" });
      
      // For now, return all active trucks as available
      // The API can be extended to support date-based availability checking
      return {
        availableTrucks: result.trucks.map((truck) => ({
          id: truck.id,
          registrationNo: truck.registrationNo,
          model: truck.model,
          driverName: truck.driverName,
        })),
        busyTrucks: [],
      };
    } catch (error) {
      console.error("Error checking truck availability:", error);
      return { availableTrucks: [], busyTrucks: [], error: "Failed to check availability" };
    }
  },
};

// Export all truck tools
export const truckTools = {
  list_trucks: listTrucks,
  get_truck_details: getTruckDetails,
  get_truck_performance: getTruckPerformance,
  check_truck_availability: checkTruckAvailability,
};
