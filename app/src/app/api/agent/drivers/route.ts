import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAgentAuth, getOrganizationId, agentJsonResponse, agentErrorResponse, handleCorsPreflightRequest } from "@/lib/agent-auth";

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

export async function POST(request: NextRequest) {
  const authError = withAgentAuth(request);
  if (authError) return authError;

  const organizationId = getOrganizationId(request);
  if (!organizationId) {
    return agentErrorResponse("Organization ID required", 400);
  }

  try {
    const body = await request.json();
    const { action, ...params } = body;

    switch (action) {
      case "list":
        return await listDrivers(organizationId, params);
      case "details":
        return await getDriverDetails(organizationId, params);
      case "availability":
        return await checkDriverAvailability(organizationId, params);
      case "expiring-licenses":
        return await getExpiringLicenses(organizationId, params);
      case "summary":
        return await getDriverSummary(organizationId);
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Agent drivers API error:", error);
    return agentErrorResponse("Internal server error", 500);
  }
}

async function listDrivers(organizationId: string, params: { status?: string; limit?: number }) {
  const { status, limit = 20 } = params;

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

  return agentJsonResponse({
    drivers: drivers.map((driver) => ({
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
      email: driver.email,
      status: driver.status,
      licenseNumber: driver.licenseNumber,
      assignedTruck: driver.assignedTruck?.registrationNo || null,
    })),
    total,
  });
}

async function getDriverDetails(organizationId: string, params: { driverId?: string; phone?: string }) {
  const { driverId, phone } = params;

  if (!driverId && !phone) {
    return agentJsonResponse({ driver: null });
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
    return agentJsonResponse({ driver: null });
  }

  const tripStats = {
    totalTrips: driver.trips.length,
    completedTrips: driver.trips.filter((t) => t.status === "completed").length,
    totalMileage: driver.trips.reduce(
      (sum, t) => sum + (t.actualMileage || t.estimatedMileage),
      0
    ),
    totalRevenue: driver.trips.reduce((sum, t) => sum + t.revenue, 0),
  };

  return agentJsonResponse({
    driver: {
      id: driver.id,
      firstName: driver.firstName,
      lastName: driver.lastName,
      email: driver.email,
      phone: driver.phone,
      whatsappNumber: driver.whatsappNumber,
      licenseNumber: driver.licenseNumber,
      passportNumber: driver.passportNumber,
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
      recentTrips: driver.trips.slice(0, 5).map((trip) => ({
        id: trip.id,
        origin: trip.originCity,
        destination: trip.destinationCity,
        status: trip.status,
        scheduledDate: trip.scheduledDate.toISOString(),
      })),
      tripStats,
      notes: driver.notes,
    },
  });
}

async function checkDriverAvailability(organizationId: string, params: { date: string; endDate?: string }) {
  const { date, endDate } = params;

  const checkDate = new Date(date);
  const checkEndDate = endDate ? new Date(endDate) : checkDate;

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
    .filter((driver) => driver.status === "active" && driver.trips.length === 0)
    .map((driver) => ({
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
      assignedTruck: driver.assignedTruck?.registrationNo || null,
    }));

  const busyDrivers = drivers
    .filter((driver) => driver.status === "active" && driver.trips.length > 0)
    .map((driver) => ({
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      tripDestination: driver.trips[0]?.destinationCity || "Unknown",
      tripStatus: driver.trips[0]?.status || "Unknown",
    }));

  const onLeaveDrivers = drivers
    .filter((driver) => driver.status === "on_leave")
    .map((driver) => ({
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
    }));

  return agentJsonResponse({
    date: checkDate.toISOString(),
    endDate: checkEndDate.toISOString(),
    availableDrivers,
    busyDrivers,
    onLeaveDrivers,
    summary: {
      available: availableDrivers.length,
      busy: busyDrivers.length,
      onLeave: onLeaveDrivers.length,
    },
  });
}

async function getExpiringLicenses(organizationId: string, params: { days?: number }) {
  const { days = 30 } = params;

  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  // Note: The Driver model doesn't have licenseExpiry field in the schema
  // For now, return drivers with endDate set (contracts ending soon)
  const drivers = await prisma.driver.findMany({
    where: {
      organizationId,
      status: { in: ["active", "on_leave"] },
      endDate: {
        lte: futureDate,
        not: null,
      },
    },
    orderBy: { endDate: "asc" },
  });

  const now = new Date();

  return agentJsonResponse({
    expiringContracts: drivers.map((driver) => ({
      id: driver.id,
      name: `${driver.firstName} ${driver.lastName}`,
      phone: driver.phone,
      licenseNumber: driver.licenseNumber,
      endDate: driver.endDate?.toISOString(),
      daysUntilExpiry: driver.endDate
        ? Math.ceil((driver.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null,
      isExpired: driver.endDate ? driver.endDate < now : false,
    })),
    checkDays: days,
  });
}

async function getDriverSummary(organizationId: string) {
  const [total, active, onLeave, suspended] = await Promise.all([
    prisma.driver.count({ where: { organizationId } }),
    prisma.driver.count({ where: { organizationId, status: "active" } }),
    prisma.driver.count({ where: { organizationId, status: "on_leave" } }),
    prisma.driver.count({ where: { organizationId, status: "suspended" } }),
  ]);

  return agentJsonResponse({
    summary: { total, active, onLeave, suspended },
  });
}
