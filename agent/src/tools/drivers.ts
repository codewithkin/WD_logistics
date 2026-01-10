import { z } from "zod";
import prisma from "../lib/prisma";

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
    const { organizationId, status, limit = 20 } = params;

    const where = {
      organizationId,
      ...(status && { status }),
    };

    const [drivers, total] = await Promise.all([
      prisma.driver.findMany({
        where,
        take: limit,
        include: {
          assignedTruck: {
            select: { registrationNo: true },
          },
        },
        orderBy: { firstName: "asc" },
      }),
      prisma.driver.count({ where }),
    ]);

    return {
      drivers: drivers.map((driver: any) => ({
        id: driver.id,
        name: `${driver.firstName} ${driver.lastName}`,
        phone: driver.phone,
        email: driver.email,
        status: driver.status,
        licenseNumber: driver.licenseNumber,
        licenseExpiry: driver.licenseExpiry?.toISOString() || null,
        assignedTruck: driver.assignedTruck?.registrationNo || null,
      })),
      total,
    };
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
    const { driverId, phone, organizationId } = params;

    if (!driverId && !phone) {
      return { driver: null };
    }

    const driver = await prisma.driver.findFirst({
      where: {
        organizationId,
        ...(driverId ? { id: driverId } : { phone }),
      },
      include: {
        assignedTruck: true,
        trips: {
          orderBy: { scheduledDate: "desc" },
        },
      },
    });

    if (!driver) {
      return { driver: null };
    }

    const tripStats = {
      totalTrips: driver.trips.length,
      completedTrips: driver.trips.filter((t: any) => t.status === "completed").length,
      totalMileage: driver.trips.reduce(
        (sum: number, t: any) => sum + (t.actualMileage || t.estimatedMileage),
        0
      ),
      totalRevenue: driver.trips.reduce((sum: number, t: any) => sum + t.revenue, 0),
    };

    return {
      driver: {
        id: driver.id,
        firstName: driver.firstName,
        lastName: driver.lastName,
        email: driver.email,
        phone: driver.phone,
        whatsappNumber: driver.whatsappNumber,
        licenseNumber: driver.licenseNumber,
        licenseExpiry: driver.licenseExpiry?.toISOString() || null,
        dateOfBirth: driver.dateOfBirth?.toISOString() || null,
        address: driver.address,
        status: driver.status,
        startDate: driver.startDate.toISOString(),
        assignedTruck: driver.assignedTruck
          ? {
              id: driver.assignedTruck.id,
              registrationNo: driver.assignedTruck.registrationNo,
              make: driver.assignedTruck.make,
              model: driver.assignedTruck.model,
            }
          : null,
        recentTrips: driver.trips.slice(0, 5).map((trip: any) => ({
          id: trip.id,
          origin: trip.originCity,
          destination: trip.destinationCity,
          status: trip.status,
          scheduledDate: trip.scheduledDate.toISOString(),
        })),
        tripStats,
        notes: driver.notes,
      },
    };
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
    const { organizationId, date, endDate } = params;

    const checkDate = new Date(date);
    const checkEndDate = endDate ? new Date(endDate) : checkDate;

    // Get all active drivers
    const drivers = await prisma.driver.findMany({
      where: {
        organizationId,
        status: { in: ["active", "on_leave"] },
      },
      include: {
        assignedTruck: true,
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

    const availableDrivers = drivers
      .filter((driver: any) => driver.status === "active" && driver.trips.length === 0)
      .map((driver: any) => ({
        id: driver.id,
        name: `${driver.firstName} ${driver.lastName}`,
        phone: driver.phone,
        assignedTruck: driver.assignedTruck?.registrationNo || null,
      }));

    const busyDrivers = drivers
      .filter((driver: any) => driver.status === "active" && driver.trips.length > 0)
      .map((driver: any) => ({
        id: driver.id,
        name: `${driver.firstName} ${driver.lastName}`,
        tripDestination: driver.trips[0]?.destinationCity || "Unknown",
        tripStatus: driver.trips[0]?.status || "Unknown",
      }));

    const onLeaveDrivers = drivers
      .filter((driver: any) => driver.status === "on_leave")
      .map((driver: any) => ({
        id: driver.id,
        name: `${driver.firstName} ${driver.lastName}`,
      }));

    return { availableDrivers, busyDrivers, onLeaveDrivers };
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
    const { organizationId, driverId, startDate, endDate } = params;

    const dateFilter: Record<string, unknown> = {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate) }),
    };

    const drivers = await prisma.driver.findMany({
      where: {
        organizationId,
        ...(driverId && { id: driverId }),
        status: { not: "terminated" },
      },
      include: {
        trips: {
          where: Object.keys(dateFilter).length > 0 ? { scheduledDate: dateFilter } : undefined,
        },
      },
    });

    const performance = drivers.map((driver: any) => {
      const completedTrips = driver.trips.filter((t: any) => t.status === "completed").length;
      const cancelledTrips = driver.trips.filter((t: any) => t.status === "cancelled").length;
      const totalMileage = driver.trips.reduce(
        (sum: number, t: any) => sum + (t.actualMileage || t.estimatedMileage),
        0
      );
      const totalRevenue = driver.trips.reduce((sum: number, t: any) => sum + t.revenue, 0);

      return {
        driverId: driver.id,
        driverName: `${driver.firstName} ${driver.lastName}`,
        tripCount: driver.trips.length,
        completedTrips,
        cancelledTrips,
        totalMileage,
        totalRevenue,
        averageRevenuePerTrip:
          driver.trips.length > 0 ? totalRevenue / driver.trips.length : 0,
        completionRate:
          driver.trips.length > 0
            ? Math.round((completedTrips / driver.trips.length) * 100)
            : 0,
      };
    });

    const summary = {
      totalDrivers: performance.length,
      totalTrips: performance.reduce((sum: number, p: any) => sum + p.tripCount, 0),
      totalRevenue: performance.reduce((sum: number, p: any) => sum + p.totalRevenue, 0),
      averageTripsPerDriver:
        performance.length > 0
          ? performance.reduce((sum: number, p: any) => sum + p.tripCount, 0) / performance.length
          : 0,
    };

    return { performance, summary };
  },
};

/**
 * Tool to check for expiring driver licenses
 */
export const getExpiringLicenses = {
  definition: {
    name: "get_expiring_licenses",
    description: "Get drivers whose licenses are expiring soon.",
    inputSchema: z.object({
      organizationId: z.string().describe("The organization ID"),
      days: z.number().optional().default(30).describe("Number of days to look ahead"),
    }),
  },
  execute: async (params: { organizationId: string; days?: number }) => {
    const { organizationId, days = 30 } = params;

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    const drivers = await prisma.driver.findMany({
      where: {
        organizationId,
        status: "active",
        licenseExpiry: {
          lte: futureDate,
        },
      },
      orderBy: { licenseExpiry: "asc" },
    });

    return {
      expiringLicenses: drivers.map((driver: any) => {
        const expiryDate = driver.licenseExpiry!;
        const daysUntilExpiry = Math.ceil(
          (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
        );
        return {
          driverId: driver.id,
          driverName: `${driver.firstName} ${driver.lastName}`,
          phone: driver.phone,
          licenseNumber: driver.licenseNumber,
          expiryDate: expiryDate.toISOString(),
          daysUntilExpiry,
          isExpired: daysUntilExpiry < 0,
        };
      }),
    };
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
