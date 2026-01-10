"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { TripStatus } from "@/lib/types";

export async function createTrip(data: {
  origin: string;
  destination: string;
  startDate: Date;
  endDate?: Date | null;
  status: TripStatus;
  truckId: string;
  driverId: string;
  customerId?: string | null;
  distance?: number | null;
  revenue: number;
  cargoDescription?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const trip = await prisma.trip.create({
      data: {
        ...data,
        organizationId: session.organizationId,
      },
    });

    // Update driver and truck status if trip is in progress
    if (data.status === "in_progress") {
      await prisma.driver.update({
        where: { id: data.driverId },
        data: { status: "on_trip" },
      });
      await prisma.truck.update({
        where: { id: data.truckId },
        data: { status: "in_transit" },
      });
    }

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
    origin?: string;
    destination?: string;
    startDate?: Date;
    endDate?: Date | null;
    status?: TripStatus;
    truckId?: string;
    driverId?: string;
    customerId?: string | null;
    distance?: number | null;
    revenue?: number;
    cargoDescription?: string;
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
          data: { status: "on_trip" },
        });
        await prisma.truck.update({
          where: { id: data.truckId || trip.truckId },
          data: { status: "in_transit" },
        });
      } else if (data.status === "completed" || data.status === "cancelled") {
        await prisma.driver.update({
          where: { id: data.driverId || trip.driverId },
          data: { status: "available" },
        });
        await prisma.truck.update({
          where: { id: data.truckId || trip.truckId },
          data: { status: "available" },
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
          select: { expenses: true, invoices: true },
        },
      },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    if (trip._count.expenses > 0 || trip._count.invoices > 0) {
      return {
        success: false,
        error: "Cannot delete trip with associated expenses or invoices",
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
        organizationId: session.organizationId,
      },
    });

    if (existingRequest) {
      return { success: false, error: "An edit request for this trip is already pending" };
    }

    await prisma.editRequest.create({
      data: {
        entityType: "trip",
        entityId: tripId,
        description: `Request to edit trip: ${trip.origin} → ${trip.destination}`,
        status: "pending",
        requestedById: session.user.id,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/edit-requests");
    return { success: true };
  } catch (error) {
    console.error("Failed to create edit request:", error);
    return { success: false, error: "Failed to submit edit request" };
  }
}
