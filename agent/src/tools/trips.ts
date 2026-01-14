import { z } from "zod";
import { tripsApi } from "../lib/api-client";

/**
 * Tool to list trips with filtering options
 */
export const listTrips = {
  definition: {
    name: "list_trips",
    description: "List trips with optional filtering by status, date range, truck, or driver.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      status: z
        .enum(["scheduled", "in_progress", "completed", "cancelled"])
        .optional()
        .describe("Filter by trip status"),
      truckId: z.string().optional().describe("Filter by specific truck"),
      driverId: z.string().optional().describe("Filter by specific driver"),
      startDate: z.string().optional().describe("Filter trips from this date"),
      endDate: z.string().optional().describe("Filter trips until this date"),
      limit: z.number().optional().default(20).describe("Maximum number of trips to return"),
    }),
  },
  execute: async (params: { organizationId: string; status?: string; truckId?: string; driverId?: string; startDate?: string; endDate?: string; limit?: number }) => {
    const { organizationId, status, truckId, driverId, startDate, endDate } = params;

    try {
      const result = await tripsApi.list(organizationId, { status, truckId, driverId, startDate, endDate });
      return {
        trips: result.trips.map((trip) => ({
          id: trip.id,
          origin: trip.originCity,
          destination: trip.destinationCity,
          truckRegistration: trip.truck.registrationNo,
          driverName: trip.driver.name,
          customerName: trip.customer.name,
          status: trip.status,
          scheduledDate: trip.scheduledDate,
          revenue: trip.revenue,
        })),
        total: result.total,
      };
    } catch (error) {
      console.error("Error listing trips:", error);
      return { trips: [], total: 0, error: "Failed to fetch trips" };
    }
  },
};

/**
 * Tool to get detailed trip information
 */
export const getTripDetails = {
  definition: {
    name: "get_trip_details",
    description: "Get detailed information about a specific trip including expenses and route details.",
    inputSchema: z.object({
      tripId: z.string().describe("The trip ID to get details for"),
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { tripId: string; organizationId: string }) => {
    const { tripId, organizationId } = params;

    try {
      const trip = await tripsApi.details(organizationId, tripId);
      return {
        trip: {
          id: trip.id,
          origin: {
            city: trip.originCity,
            address: trip.originAddress,
          },
          destination: {
            city: trip.destinationCity,
            address: trip.destinationAddress,
          },
          truck: trip.truck,
          driver: trip.driver,
          customer: trip.customer,
          revenue: trip.revenue,
          status: trip.status,
          scheduledDate: trip.scheduledDate,
          startDate: trip.startedAt,
          endDate: trip.completedAt,
          expenses: trip.expenses,
          totalExpenses: trip.totalExpenses,
          profit: trip.profit,
          notes: trip.notes,
        },
      };
    } catch (error) {
      console.error("Error getting trip details:", error);
      return { trip: null, error: "Failed to fetch trip details" };
    }
  },
};

/**
 * Tool to get trip statistics and summary
 */
export const getTripStats = {
  definition: {
    name: "get_trip_stats",
    description: "Get trip statistics including counts by status, total revenue, and mileage for a time period.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      startDate: z.string().optional().describe("Start date for analysis"),
      endDate: z.string().optional().describe("End date for analysis"),
    }),
  },
  execute: async (params: { organizationId: string; startDate?: string; endDate?: string }) => {
    const { organizationId, startDate, endDate } = params;

    try {
      const result = await tripsApi.stats(organizationId, startDate, endDate);
      return {
        stats: {
          totalTrips: result.total,
          byStatus: result.byStatus,
          totalRevenue: result.totalRevenue,
          totalMileage: result.totalDistance,
          averageRevenuePerTrip: result.total > 0 ? result.totalRevenue / result.total : 0,
          averageMileagePerTrip: result.total > 0 ? result.totalDistance / result.total : 0,
        },
        topRoutes: [], // Can be added to the API if needed
      };
    } catch (error) {
      console.error("Error getting trip stats:", error);
      return { stats: null, topRoutes: [], error: "Failed to fetch trip stats" };
    }
  },
};

/**
 * Tool to get upcoming trips
 */
export const getUpcomingTrips = {
  definition: {
    name: "get_upcoming_trips",
    description: "Get trips scheduled for the next few days.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      days: z.number().optional().default(7).describe("Number of days to look ahead"),
    }),
  },
  execute: async (params: { organizationId: string; days?: number }) => {
    const { organizationId, days = 7 } = params;

    try {
      const result = await tripsApi.upcoming(organizationId, days);
      const now = new Date();
      
      return {
        trips: result.trips.map((trip) => {
          const tripDate = new Date(trip.scheduledDate);
          const daysUntil = Math.ceil((tripDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return {
            id: trip.id,
            origin: trip.originCity,
            destination: trip.destinationCity,
            truckRegistration: trip.truck.registrationNo,
            driverName: trip.driver.name,
            customerName: trip.customer.name,
            scheduledDate: trip.scheduledDate,
            daysUntil,
          };
        }),
      };
    } catch (error) {
      console.error("Error getting upcoming trips:", error);
      return { trips: [], error: "Failed to fetch upcoming trips" };
    }
  },
};

/**
 * Tool to get today's trips
 */
export const getTodaysTrips = {
  definition: {
    name: "get_todays_trips",
    description: "Get all trips scheduled for today.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
    }),
  },
  execute: async (params: { organizationId: string }) => {
    const { organizationId } = params;

    try {
      const result = await tripsApi.today(organizationId);
      return {
        trips: result.trips.map((trip) => ({
          id: trip.id,
          origin: trip.originCity,
          destination: trip.destinationCity,
          truckRegistration: trip.truck.registrationNo,
          driverName: trip.driver.name,
          customerName: trip.customer.name,
          status: trip.status,
          scheduledDate: trip.scheduledDate,
        })),
      };
    } catch (error) {
      console.error("Error getting today's trips:", error);
      return { trips: [], error: "Failed to fetch today's trips" };
    }
  },
};

// Export all trip tools
export const tripTools = {
  list_trips: listTrips,
  get_trip_details: getTripDetails,
  get_trip_stats: getTripStats,
  get_upcoming_trips: getUpcomingTrips,
  get_todays_trips: getTodaysTrips,
};
