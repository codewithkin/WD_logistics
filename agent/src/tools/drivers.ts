import { z } from "zod";
import { driversApi } from "../lib/api-client";

/**
 * Tool to list drivers with optional filtering
 */
export const listDrivers = {
  definition: {
    name: "list_drivers",
    description: "List all drivers with optional status filter. Use this to get an overview of available drivers.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      status: z
        .enum(["active", "on_leave", "suspended", "terminated"])
        .optional()
        .describe("Filter by driver status"),
      limit: z.number().optional().default(20).describe("Maximum number of drivers to return"),
    }),
  },
  execute: async (params: { organizationId: string; status?: string; limit?: number }) => {
    const { organizationId, status } = params;

    try {
      const result = await driversApi.list(organizationId, { status });
      return {
        drivers: result.drivers.map((driver) => ({
          id: driver.id,
          name: `${driver.firstName} ${driver.lastName}`,
          phone: driver.phone,
          status: driver.status,
          licenseNumber: driver.licenseNumber,
          assignedTruck: driver.assignedTruck,
        })),
        total: result.total,
      };
    } catch (error) {
      console.error("Error listing drivers:", error);
      return { drivers: [], total: 0, error: "Failed to fetch drivers" };
    }
  },
};

/**
 * Tool to get detailed driver information
 */
export const getDriverDetails = {
  definition: {
    name: "get_driver_details",
    description: "Get detailed information about a specific driver including their assigned truck and recent trips.",
    inputSchema: z.object({
      driverId: z.string().optional().describe("The driver ID"),
      phone: z.string().optional().describe("The driver's phone number"),
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { driverId?: string; phone?: string; organizationId: string }) => {
    const { driverId, organizationId } = params;

    if (!driverId) {
      return { driver: null };
    }

    try {
      const driver = await driversApi.details(organizationId, driverId);
      return { driver };
    } catch (error) {
      console.error("Error getting driver details:", error);
      return { driver: null, error: "Failed to fetch driver details" };
    }
  },
};

/**
 * Tool to check driver availability
 */
export const checkDriverAvailability = {
  definition: {
    name: "check_driver_availability",
    description: "Check which drivers are available for trips on a specific date or date range.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      date: z.string().describe("The date to check availability (ISO format)"),
      endDate: z.string().optional().describe("Optional end date for range check"),
    }),
  },
  execute: async (params: { organizationId: string; date: string; endDate?: string }) => {
    const { organizationId, date } = params;

    try {
      const result = await driversApi.availability(organizationId, date);
      return {
        availableDrivers: result.available,
        busyDrivers: result.busy,
        onLeaveDrivers: result.onLeave,
      };
    } catch (error) {
      console.error("Error checking driver availability:", error);
      return { availableDrivers: [], busyDrivers: [], onLeaveDrivers: [], error: "Failed to check availability" };
    }
  },
};

/**
 * Tool to get driver performance metrics
 */
export const getDriverPerformance = {
  definition: {
    name: "get_driver_performance",
    description: "Get performance metrics for drivers including trip counts, revenue, and mileage.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      driverId: z.string().optional().describe("Optional: specific driver ID to analyze"),
      startDate: z.string().optional().describe("Start date for analysis (ISO format)"),
      endDate: z.string().optional().describe("End date for analysis (ISO format)"),
    }),
  },
  execute: async (params: { organizationId: string; driverId?: string; startDate?: string; endDate?: string }) => {
    const { organizationId, driverId } = params;

    try {
      if (driverId) {
        const driver = await driversApi.details(organizationId, driverId);
        return {
          performance: [{
            driverId: driver.id,
            driverName: `${driver.firstName} ${driver.lastName}`,
            tripCount: driver.tripStats.total,
            completedTrips: driver.tripStats.completed,
            inProgressTrips: driver.tripStats.inProgress,
          }],
          summary: {
            totalDrivers: 1,
            totalTrips: driver.tripStats.total,
          },
        };
      }
      
      // Get summary for all drivers
      const summary = await driversApi.summary(organizationId);
      return {
        performance: [],
        summary: {
          totalDrivers: summary.total,
          byStatus: summary.byStatus,
        },
      };
    } catch (error) {
      console.error("Error getting driver performance:", error);
      return { performance: [], summary: null, error: "Failed to fetch driver performance" };
    }
  },
};

/**
 * Tool to check for expiring driver contracts
 */
export const getExpiringLicenses = {
  definition: {
    name: "get_expiring_licenses",
    description: "Get drivers whose contracts are expiring soon.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      days: z.number().optional().default(30).describe("Number of days to look ahead"),
    }),
  },
  execute: async (params: { organizationId: string; days?: number }) => {
    const { organizationId, days = 30 } = params;

    try {
      const result = await driversApi.expiringLicenses(organizationId, days);
      return {
        expiringContracts: result.expiringContracts.map((driver) => ({
          driverId: driver.id,
          driverName: driver.name,
          endDate: driver.endDate,
          daysUntilExpiry: driver.daysUntilExpiry,
          isExpired: driver.daysUntilExpiry < 0,
        })),
      };
    } catch (error) {
      console.error("Error getting expiring contracts:", error);
      return { expiringContracts: [], error: "Failed to fetch expiring contracts" };
    }
  },
};

// Export all driver tools
export const driverTools = {
  list_drivers: listDrivers,
  get_driver_details: getDriverDetails,
  check_driver_availability: checkDriverAvailability,
  get_driver_performance: getDriverPerformance,
  get_expiring_licenses: getExpiringLicenses,
};
