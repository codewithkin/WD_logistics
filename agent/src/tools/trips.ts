import { z } from "zod";
import prisma from "../lib/prisma";

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
    const { organizationId, status, truckId, driverId, startDate, endDate, limit = 20 } = params;

    const where = {
      organizationId,
      ...(status && { status }),
      ...(truckId && { truckId }),
      ...(driverId && { driverId }),
      ...(startDate && { scheduledDate: { gte: new Date(startDate) } }),
      ...(endDate && { scheduledDate: { lte: new Date(endDate) } }),
    };

    const [trips, total] = await Promise.all([
      prisma.trip.findMany({
        where,
        take: limit,
        include: {
          truck: { select: { registrationNo: true } },
          driver: { select: { firstName: true, lastName: true } },
          customer: { select: { name: true } },
        },
        orderBy: { scheduledDate: "desc" },
      }),
      prisma.trip.count({ where }),
    ]);

    return {
      trips: trips.map((trip: any) => ({
        id: trip.id,
        origin: trip.originCity,
        destination: trip.destinationCity,
        truckRegistration: trip.truck.registrationNo,
        driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
        customerName: trip.customer?.name || null,
        status: trip.status,
        scheduledDate: trip.scheduledDate.toISOString(),
        revenue: trip.revenue,
        estimatedMileage: trip.estimatedMileage,
      })),
      total,
    };
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
    }),
  },
  execute: async (params: { tripId: string }) => {
    const { tripId } = params;

    const trip = await prisma.trip.findUnique({
      where: { id: tripId },
      include: {
        truck: true,
        driver: true,
        customer: true,
        tripExpenses: {
          include: {
            expense: {
              include: { category: true },
            },
          },
        },
      },
    });

    if (!trip) {
      return { trip: null };
    }

    const totalExpenses = trip.tripExpenses.reduce(
      (sum: number, te: any) => sum + te.expense.amount,
      0
    );

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
        truck: {
          id: trip.truck.id,
          registrationNo: trip.truck.registrationNo,
          make: trip.truck.make,
          model: trip.truck.model,
        },
        driver: {
          id: trip.driver.id,
          name: `${trip.driver.firstName} ${trip.driver.lastName}`,
          phone: trip.driver.phone,
        },
        customer: trip.customer
          ? {
              id: trip.customer.id,
              name: trip.customer.name,
            }
          : null,
        loadDescription: trip.loadDescription,
        loadWeight: trip.loadWeight,
        loadUnits: trip.loadUnits,
        estimatedMileage: trip.estimatedMileage,
        actualMileage: trip.actualMileage,
        revenue: trip.revenue,
        status: trip.status,
        scheduledDate: trip.scheduledDate.toISOString(),
        startDate: trip.startDate?.toISOString() || null,
        endDate: trip.endDate?.toISOString() || null,
        driverNotified: trip.driverNotified,
        expenses: trip.tripExpenses.map((te: any) => ({
          id: te.expense.id,
          category: te.expense.category.name,
          amount: te.expense.amount,
          description: te.expense.description,
        })),
        totalExpenses,
        profit: trip.revenue - totalExpenses,
        notes: trip.notes,
      },
    };
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

    const dateFilter: Record<string, unknown> = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };

    const trips = await prisma.trip.findMany({
      where: {
        organizationId,
        ...(Object.keys(dateFilter).length > 0 && { scheduledDate: dateFilter }),
      },
    });

    const stats = {
      totalTrips: trips.length,
      scheduled: trips.filter((t: any) => t.status === "scheduled").length,
      inProgress: trips.filter((t: any) => t.status === "in_progress").length,
      completed: trips.filter((t: any) => t.status === "completed").length,
      cancelled: trips.filter((t: any) => t.status === "cancelled").length,
      totalRevenue: trips.reduce((sum: number, t: any) => sum + t.revenue, 0),
      totalMileage: trips.reduce(
        (sum: number, t: any) => sum + (t.actualMileage || t.estimatedMileage),
        0
      ),
      averageRevenuePerTrip:
        trips.length > 0
          ? trips.reduce((sum: number, t: any) => sum + t.revenue, 0) / trips.length
          : 0,
      averageMileagePerTrip:
        trips.length > 0
          ? trips.reduce((sum: number, t: any) => sum + (t.actualMileage || t.estimatedMileage), 0) /
            trips.length
          : 0,
    };

    // Calculate top routes
    const routeMap = new Map<string, { count: number; revenue: number }>();
    trips.forEach((trip: any) => {
      const key = `${trip.originCity}-${trip.destinationCity}`;
      const existing = routeMap.get(key) || { count: 0, revenue: 0 };
      routeMap.set(key, {
        count: existing.count + 1,
        revenue: existing.revenue + trip.revenue,
      });
    });

    const topRoutes = Array.from(routeMap.entries())
      .map(([route, data]) => {
        const [origin, destination] = route.split("-");
        return {
          origin,
          destination,
          count: data.count,
          totalRevenue: data.revenue,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { stats, topRoutes };
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

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const trips = await prisma.trip.findMany({
      where: {
        organizationId,
        status: "scheduled",
        scheduledDate: {
          gte: now,
          lte: futureDate,
        },
      },
      include: {
        truck: { select: { registrationNo: true } },
        driver: { select: { firstName: true, lastName: true } },
        customer: { select: { name: true } },
      },
      orderBy: { scheduledDate: "asc" },
    });

    return {
      trips: trips.map((trip: any) => {
        const daysUntil = Math.ceil(
          (trip.scheduledDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          id: trip.id,
          origin: trip.originCity,
          destination: trip.destinationCity,
          truckRegistration: trip.truck.registrationNo,
          driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
          customerName: trip.customer?.name || null,
          scheduledDate: trip.scheduledDate.toISOString(),
          daysUntil,
          driverNotified: trip.driverNotified,
        };
      }),
    };
  },
};

// Export all trip tools
export const tripTools = {
  list_trips: listTrips,
  get_trip_details: getTripDetails,
  get_trip_stats: getTripStats,
  get_upcoming_trips: getUpcomingTrips,
};
