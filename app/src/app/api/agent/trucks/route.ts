import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAgentAuth, getOrganizationId, agentJsonResponse, agentErrorResponse, handleCorsPreflightRequest } from "@/lib/agent-auth";

export async function OPTIONS() {
  return handleCorsPreflightRequest();
}

export async function POST(request: NextRequest) {
  // Validate agent authentication
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
        return await listTrucks(organizationId, params);
      case "details":
        return await getTruckDetails(organizationId, params);
      case "performance":
        return await getTruckPerformance(organizationId, params);
      case "summary":
        return await getTruckSummary(organizationId);
      default:
        return agentErrorResponse("Invalid action", 400);
    }
  } catch (error) {
    console.error("Agent trucks API error:", error);
    return agentErrorResponse("Internal server error", 500);
  }
}

async function listTrucks(organizationId: string, params: { status?: string; limit?: number }) {
  const { status, limit = 20 } = params;

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

  return agentJsonResponse({
    trucks: trucks.map((truck) => ({
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
  });
}

async function getTruckDetails(organizationId: string, params: { truckId?: string; registrationNo?: string }) {
  const { truckId, registrationNo } = params;

  if (!truckId && !registrationNo) {
    return agentJsonResponse({ truck: null });
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
    return agentJsonResponse({ truck: null });
  }

  const totalExpenses = truck.truckExpenses.reduce(
    (sum: number, te) => sum + te.expense.amount,
    0
  );
  const totalRevenue = truck.trips.reduce((sum: number, trip) => sum + trip.revenue, 0);

  return agentJsonResponse({
    truck: {
      id: truck.id,
      registrationNo: truck.registrationNo,
      make: truck.make,
      model: truck.model,
      year: truck.year,
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
      recentTrips: truck.trips.map((trip) => ({
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
  });
}

async function getTruckPerformance(organizationId: string, params: { truckId?: string; startDate?: string; endDate?: string }) {
  const { truckId, startDate, endDate } = params;

  const dateFilter: Record<string, Date> = {};
  if (startDate) dateFilter.gte = new Date(startDate);
  if (endDate) dateFilter.lte = new Date(endDate);

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
        include: { expense: true },
      },
    },
  });

  const performance = trucks.map((truck) => {
    const totalRevenue = truck.trips.reduce((sum: number, trip) => sum + trip.revenue, 0);
    
    // Filter expenses by date if needed
    const relevantExpenses = Object.keys(dateFilter).length > 0 
      ? truck.truckExpenses.filter(te => {
          const expenseDate = te.expense.date;
          if (dateFilter.gte && expenseDate < dateFilter.gte) return false;
          if (dateFilter.lte && expenseDate > dateFilter.lte) return false;
          return true;
        })
      : truck.truckExpenses;
    
    const totalExpenses = relevantExpenses.reduce(
      (sum: number, te) => sum + te.expense.amount,
      0
    );
    const totalMileage = truck.trips.reduce(
      (sum: number, trip) => sum + (trip.actualMileage || trip.estimatedMileage),
      0
    );
    const profit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;

    return {
      truckId: truck.id,
      registrationNo: truck.registrationNo,
      tripCount: truck.trips.length,
      totalRevenue,
      totalExpenses,
      profit,
      profitMargin: Math.round(profitMargin * 100) / 100,
      totalMileage,
      revenuePerMile: totalMileage > 0 ? Math.round((totalRevenue / totalMileage) * 100) / 100 : 0,
    };
  });

  return agentJsonResponse({ performance });
}

async function getTruckSummary(organizationId: string) {
  const [total, active, inService, inRepair, inactive] = await Promise.all([
    prisma.truck.count({ where: { organizationId } }),
    prisma.truck.count({ where: { organizationId, status: "active" } }),
    prisma.truck.count({ where: { organizationId, status: "in_service" } }),
    prisma.truck.count({ where: { organizationId, status: "in_repair" } }),
    prisma.truck.count({ where: { organizationId, status: "inactive" } }),
  ]);

  return agentJsonResponse({
    summary: { total, active, inService, inRepair, inactive },
  });
}
