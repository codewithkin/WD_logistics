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
        return await listTrips(organizationId, params);
      case "details":
        return await getTripDetails(params);
      case "stats":
        return await getTripStats(organizationId, params);
      case "today":
        return await getTodaysTrips(organizationId);
      case "upcoming":
        return await getUpcomingTrips(organizationId, params);
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Agent trips API error:", error);
    return agentErrorResponse("Internal server error", 500);
  }
}

async function listTrips(organizationId: string, params: { 
  status?: string; 
  truckId?: string; 
  driverId?: string; 
  startDate?: string; 
  endDate?: string; 
  limit?: number 
}) {
  const { status, truckId, driverId, startDate, endDate, limit = 20 } = params;

  const where: Record<string, unknown> = { organizationId };
  if (status) where.status = status;
  if (truckId) where.truckId = truckId;
  if (driverId) where.driverId = driverId;
  if (startDate) where.scheduledDate = { ...(where.scheduledDate as object || {}), gte: new Date(startDate) };
  if (endDate) where.scheduledDate = { ...(where.scheduledDate as object || {}), lte: new Date(endDate) };

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

  return agentJsonResponse({
    trips: trips.map((trip) => ({
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
  });
}

async function getTripDetails(params: { tripId: string }) {
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
    return agentJsonResponse({ trip: null });
  }

  const totalExpenses = trip.tripExpenses.reduce(
    (sum, te) => sum + te.expense.amount,
    0
  );

  return agentJsonResponse({
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
      expenses: trip.tripExpenses.map((te) => ({
        id: te.expense.id,
        category: te.expense.category?.name || "Unknown",
        amount: te.expense.amount,
        description: te.expense.description,
      })),
      totalExpenses,
      profit: trip.revenue - totalExpenses,
      notes: trip.notes,
    },
  });
}

async function getTripStats(organizationId: string, params: { startDate?: string; endDate?: string }) {
  const { startDate, endDate } = params;

  const dateFilter: Record<string, unknown> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

  const trips = await prisma.trip.findMany({
    where: {
      organizationId,
      ...(Object.keys(dateFilter).length > 0 && { scheduledDate: dateFilter }),
    },
  });

  const stats = {
    totalTrips: trips.length,
    scheduled: trips.filter((t) => t.status === "scheduled").length,
    inProgress: trips.filter((t) => t.status === "in_progress").length,
    completed: trips.filter((t) => t.status === "completed").length,
    cancelled: trips.filter((t) => t.status === "cancelled").length,
    totalRevenue: trips.reduce((sum, t) => sum + t.revenue, 0),
    totalMileage: trips.reduce(
      (sum, t) => sum + (t.actualMileage || t.estimatedMileage),
      0
    ),
    averageRevenuePerTrip:
      trips.length > 0
        ? Math.round(trips.reduce((sum, t) => sum + t.revenue, 0) / trips.length)
        : 0,
  };

  return agentJsonResponse({ stats });
}

async function getTodaysTrips(organizationId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const trips = await prisma.trip.findMany({
    where: {
      organizationId,
      scheduledDate: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      truck: { select: { registrationNo: true } },
      driver: { select: { firstName: true, lastName: true } },
      customer: { select: { name: true } },
    },
    orderBy: { scheduledDate: "asc" },
  });

  return agentJsonResponse({
    date: today.toISOString().split("T")[0],
    trips: trips.map((trip) => ({
      id: trip.id,
      origin: trip.originCity,
      destination: trip.destinationCity,
      truckRegistration: trip.truck.registrationNo,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
      customerName: trip.customer?.name || null,
      status: trip.status,
      scheduledDate: trip.scheduledDate.toISOString(),
      revenue: trip.revenue,
    })),
    total: trips.length,
  });
}

async function getUpcomingTrips(organizationId: string, params: { days?: number; limit?: number }) {
  const { days = 7, limit = 20 } = params;

  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  const trips = await prisma.trip.findMany({
    where: {
      organizationId,
      scheduledDate: {
        gte: now,
        lte: futureDate,
      },
      status: "scheduled",
    },
    include: {
      truck: { select: { registrationNo: true } },
      driver: { select: { firstName: true, lastName: true } },
      customer: { select: { name: true } },
    },
    orderBy: { scheduledDate: "asc" },
    take: limit,
  });

  return agentJsonResponse({
    days,
    trips: trips.map((trip) => ({
      id: trip.id,
      origin: trip.originCity,
      destination: trip.destinationCity,
      truckRegistration: trip.truck.registrationNo,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
      customerName: trip.customer?.name || null,
      scheduledDate: trip.scheduledDate.toISOString(),
      revenue: trip.revenue,
    })),
    total: trips.length,
  });
}
