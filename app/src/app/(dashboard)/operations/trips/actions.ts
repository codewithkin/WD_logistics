"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { TripStatus } from "@/lib/types";

const AGENT_URL = process.env.AGENT_URL || "http://localhost:3001";

/**
 * Notify driver about trip assignment via WhatsApp
 */
async function notifyDriverOfTrip(tripId: string, organizationId: string) {
  try {
    await fetch(`${AGENT_URL}/webhooks/trip-assigned`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tripId,
        organizationId,
        sendImmediately: true,
      }),
    });
  } catch (error) {
    console.error("Failed to notify driver:", error);
    // Don't throw - this is a non-blocking notification
  }
}

export async function createTrip(data: {
  originCity: string;
  originAddress?: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationCity: string;
  destinationAddress?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  loadDescription?: string;
  loadWeight?: number | null;
  loadUnits?: number | null;
  estimatedMileage: number;
  actualMileage?: number | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  revenue: number;
  scheduledDate: Date;
  startDate?: Date | null;
  endDate?: Date | null;
  truckId: string;
  driverId: string;
  customerId: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  // Auto-determine status based on scheduled date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduledDay = new Date(data.scheduledDate);
  scheduledDay.setHours(0, 0, 0, 0);
  const status: TripStatus = scheduledDay <= today ? "in_progress" : "scheduled";

  try {
    const trip = await prisma.trip.create({
      data: {
        originCity: data.originCity,
        originAddress: data.originAddress,
        originLat: data.originLat,
        originLng: data.originLng,
        destinationCity: data.destinationCity,
        destinationAddress: data.destinationAddress,
        destinationLat: data.destinationLat,
        destinationLng: data.destinationLng,
        loadDescription: data.loadDescription,
        loadWeight: data.loadWeight,
        loadUnits: data.loadUnits,
        estimatedMileage: data.estimatedMileage,
        actualMileage: data.actualMileage,
        startOdometer: data.startOdometer,
        endOdometer: data.endOdometer,
        revenue: data.revenue,
        status: status,
        scheduledDate: data.scheduledDate,
        startDate: data.startDate,
        endDate: data.endDate,
        truckId: data.truckId,
        driverId: data.driverId,
        customerId: data.customerId,
        notes: data.notes,
        organizationId: session.organizationId,
      },
    });

    // Update driver and truck status if trip is in progress
    if (status === "in_progress") {
      await prisma.driver.update({
        where: { id: data.driverId },
        data: { status: "active" },
      });
      await prisma.truck.update({
        where: { id: data.truckId },
        data: { status: "in_service" },
      });
    }

    // Notify driver via WhatsApp (async, don't block)
    notifyDriverOfTrip(trip.id, session.organizationId);

    revalidatePath("/operations/trips");
    revalidatePath("/fleet/trucks");
    revalidatePath("/fleet/drivers");
    return { success: true, trip };
  } catch (error) {
    console.error("Failed to create trip:", error);
    return { success: false, error: "Failed to create trip" };
  }
}

export async function updateTrip(
  id: string,
  data: {
    originCity?: string;
    originAddress?: string;
    originLat?: number | null;
    originLng?: number | null;
    destinationCity?: string;
    destinationAddress?: string;
    destinationLat?: number | null;
    destinationLng?: number | null;
    loadDescription?: string;
    loadWeight?: number | null;
    loadUnits?: number | null;
    estimatedMileage?: number;
    actualMileage?: number | null;
    startOdometer?: number | null;
    endOdometer?: number | null;
    revenue?: number;
    status?: TripStatus;
    scheduledDate?: Date;
    startDate?: Date | null;
    endDate?: Date | null;
    truckId?: string;
    driverId?: string;
    customerId?: string | null;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const trip = await prisma.trip.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data,
    });

    // Handle status changes
    if (data.status && data.status !== trip.status) {
      if (data.status === "in_progress") {
        await prisma.driver.update({
          where: { id: data.driverId || trip.driverId },
          data: { status: "active" },
        });
        await prisma.truck.update({
          where: { id: data.truckId || trip.truckId },
          data: { status: "in_service" },
        });
      } else if (data.status === "completed" || data.status === "cancelled") {
        await prisma.driver.update({
          where: { id: data.driverId || trip.driverId },
          data: { status: "active" },
        });
        await prisma.truck.update({
          where: { id: data.truckId || trip.truckId },
          data: { status: "active" },
        });
      }
    }

    revalidatePath("/operations/trips");
    revalidatePath(`/operations/trips/${id}`);
    revalidatePath("/fleet/trucks");
    revalidatePath("/fleet/drivers");
    return { success: true, trip: updatedTrip };
  } catch (error) {
    console.error("Failed to update trip:", error);
    return { success: false, error: "Failed to update trip" };
  }
}

export async function deleteTrip(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const trip = await prisma.trip.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { tripExpenses: true },
        },
      },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    if (trip._count.tripExpenses > 0) {
      return {
        success: false,
        error: "Cannot delete trip with associated expenses",
      };
    }

    await prisma.trip.delete({ where: { id } });

    revalidatePath("/operations/trips");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete trip:", error);
    return { success: false, error: "Failed to delete trip" };
  }
}

export async function requestEditTrip(tripId: string) {
  const session = await requireAuth();

  try {
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, organizationId: session.organizationId },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    const existingRequest = await prisma.editRequest.findFirst({
      where: {
        entityType: "trip",
        entityId: tripId,
        status: "pending",
      },
    });

    if (existingRequest) {
      return { success: false, error: "An edit request for this trip is already pending" };
    }

    await prisma.editRequest.create({
      data: {
        entityType: "trip",
        entityId: tripId,
        reason: `Request to edit trip: ${trip.originCity} → ${trip.destinationCity}`,
        originalData: trip,
        proposedData: {},
        status: "pending",
        requestedById: session.user.id,
      },
    });

    revalidatePath("/edit-requests");
    return { success: true };
  } catch (error) {
    console.error("Failed to create edit request:", error);
    return { success: false, error: "Failed to submit edit request" };
  }
}
