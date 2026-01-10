import { z } from "zod";
import prisma from "../lib/prisma";

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
    const { organizationId, status, limit = 20 } = params;

    const where = {
      organizationId,
      ...(status && { status }),
    };

    const [trucks, total] = await Promise.all([
      prisma.truck.findMany({
        where,
        take: limit,
        include: {
          assignedDriver: {
            select: { firstName: true, lastName: true },
          },
        },
        orderBy: { registrationNo: "asc" },
      }),
      prisma.truck.count({ where }),
    ]);

    return {
      trucks: trucks.map((truck: any) => ({
        id: truck.id,
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        status: truck.status,
        currentMileage: truck.currentMileage,
        driverName: truck.assignedDriver
          ? `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}`
          : null,
      })),
      total,
    };
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
    const { truckId, registrationNo, organizationId } = params;

    if (!truckId && !registrationNo) {
      return { truck: null };
    }

    const truck = await prisma.truck.findFirst({
      where: {
        organizationId,
        ...(truckId ? { id: truckId } : { registrationNo }),
      },
      include: {
        assignedDriver: true,
        trips: {
          take: 5,
          orderBy: { scheduledDate: "desc" },
        },
        truckExpenses: {
          include: { expense: true },
        },
      },
    });

    if (!truck) {
      return { truck: null };
    }

    const totalExpenses = truck.truckExpenses.reduce(
      (sum: number, te: any) => sum + te.expense.amount,
      0
    );
    const totalRevenue = truck.trips.reduce((sum: number, trip: any) => sum + trip.revenue, 0);

    return {
      truck: {
        id: truck.id,
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        chassisNumber: truck.chassisNumber,
        engineNumber: truck.engineNumber,
        status: truck.status,
        currentMileage: truck.currentMileage,
        fuelType: truck.fuelType,
        tankCapacity: truck.tankCapacity,
        notes: truck.notes,
        driver: truck.assignedDriver
          ? {
              id: truck.assignedDriver.id,
              name: `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}`,
              phone: truck.assignedDriver.phone,
            }
          : null,
        recentTrips: truck.trips.map((trip: any) => ({
          id: trip.id,
          origin: trip.originCity,
          destination: trip.destinationCity,
          status: trip.status,
          scheduledDate: trip.scheduledDate.toISOString(),
          revenue: trip.revenue,
        })),
        totalExpenses,
        totalRevenue,
      },
    };
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

    const dateFilter: Record<string, unknown> = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };

    const trucks = await prisma.truck.findMany({
      where: {
        organizationId,
        ...(truckId && { id: truckId }),
      },
      include: {
        trips: {
          where: Object.keys(dateFilter).length > 0 ? { scheduledDate: dateFilter } : undefined,
        },
        truckExpenses: {
          include: {
            expense: {
              where: Object.keys(dateFilter).length > 0 ? { date: dateFilter } : undefined,
            },
          },
        },
      },
    });

    const performance = trucks.map((truck: any) => {
      const totalRevenue = truck.trips.reduce((sum: number, trip: any) => sum + trip.revenue, 0);
      const totalExpenses = truck.truckExpenses.reduce(
        (sum: number, te: any) => sum + te.expense.amount,
        0
      );
      const totalMileage = truck.trips.reduce(
        (sum: number, trip: any) => sum + (trip.actualMileage || trip.estimatedMileage),
        0
      );
      const profit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

      return {
        truckId: truck.id,
        registrationNo: truck.registrationNo,
        tripCount: truck.trips.length,
        completedTrips: truck.trips.filter((t: any) => t.status === "completed").length,
        totalMileage,
        totalRevenue,
        totalExpenses,
        profit,
        profitMargin: Math.round(profitMargin * 100) / 100,
      };
    });

    const summary = {
      totalTrucks: performance.length,
      totalRevenue: performance.reduce((sum: number, p: any) => sum + p.totalRevenue, 0),
      totalExpenses: performance.reduce((sum: number, p: any) => sum + p.totalExpenses, 0),
      totalProfit: performance.reduce((sum: number, p: any) => sum + p.profit, 0),
      averageProfitPerTruck:
        performance.length > 0
          ? performance.reduce((sum: number, p: any) => sum + p.profit, 0) / performance.length
          : 0,
    };

    return { performance, summary };
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
    const { organizationId, date, endDate } = params;

    const checkDate = new Date(date);
    const checkEndDate = endDate ? new Date(endDate) : checkDate;

    // Get all active trucks
    const trucks = await prisma.truck.findMany({
      where: {
        organizationId,
        status: "active",
      },
      include: {
        assignedDriver: true,
        trips: {
          where: {
            status: { in: ["scheduled", "in_progress"] },
            scheduledDate: {
              lte: checkEndDate,
            },
            OR: [{ endDate: null }, { endDate: { gte: checkDate } }],
          },
        },
      },
    });

    const availableTrucks = trucks
      .filter((truck: any) => truck.trips.length === 0)
      .map((truck: any) => ({
        id: truck.id,
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        driverName: truck.assignedDriver
          ? `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}`
          : null,
      }));

    const busyTrucks = trucks
      .filter((truck: any) => truck.trips.length > 0)
      .map((truck: any) => ({
        id: truck.id,
        registrationNo: truck.registrationNo,
        tripDestination: truck.trips[0]?.destinationCity || "Unknown",
        tripStatus: truck.trips[0]?.status || "Unknown",
      }));

    return { availableTrucks, busyTrucks };
  },
};

// Export all truck tools
export const truckTools = {
  list_trucks: listTrucks,
  get_truck_details: getTruckDetails,
  get_truck_performance: getTruckPerformance,
  check_truck_availability: checkTruckAvailability,
};
