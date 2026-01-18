"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { sendTripAssignmentEmail } from "@/lib/email";

/**
 * Notify driver about trip assignment via Email
 */
export async function notifyDriverByEmail(tripId: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    // Fetch trip with driver and truck details
    const trip = await prisma.trip.findFirst({
      where: { 
        id: tripId,
        organizationId: session.organizationId 
      },
      include: {
        driver: { select: { firstName: true, lastName: true, email: true } },
        truck: { select: { registrationNo: true } },
        customer: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    if (!trip.driver.email) {
      return { success: false, error: "Driver has no email address configured" };
    }

    await sendTripAssignmentEmail({
      driverEmail: trip.driver.email,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
      origin: trip.originCity,
      destination: trip.destinationCity,
      scheduledDate: trip.scheduledDate,
      loadDescription: trip.loadDescription || undefined,
      truckRegistration: trip.truck.registrationNo,
      customerName: trip.customer?.name || undefined,
      notes: trip.notes || undefined,
      organizationName: trip.organization?.name || undefined,
    });

    // Mark as notified
    await prisma.trip.update({
      where: { id: tripId },
      data: { 
        driverNotified: true, 
        notifiedAt: new Date() 
      },
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to notify driver:", error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Failed to send email notification" 
    };
  }
}
