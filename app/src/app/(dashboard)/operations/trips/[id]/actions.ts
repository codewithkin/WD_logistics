"use server";

/**
 * Telling a driver about their trip, and recording whether it arrived.
 *
 * This file used to hold a second, divergent send path: it used the app's own
 * in-process WhatsApp client rather than the agent's, referenced
 * `trip.tripNumber` (a column that does not exist, and which therefore put
 * the word "undefined" in the message), refused outright when a driver had no
 * `whatsappNumber` even when their phone number would have worked, and set
 * `driverNotified` without recording anything about the attempt.
 *
 * All of that now goes through lib/whatsapp/trip-messages.
 */

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import {
  driverWhatsAppNumber,
  sendTripMessage,
} from "@/lib/whatsapp/trip-messages";
import { buildTripMessage } from "../_lib/message-template";

/**
 * Sends (or resends) the trip message to the driver.
 *
 * Returns rather than throws: the trip page shows the outcome, and a failure
 * here is information, not an error the user needs to see as a crash.
 */
export async function resendTripMessage(tripId: string) {
  const session = await requireRole(["admin", "supervisor"]);

  const trip = await prisma.trip.findFirst({
    where: { id: tripId, organizationId: session.organizationId },
    include: {
      driver: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          whatsappNumber: true,
        },
      },
      truck: { select: { registrationNo: true } },
      customer: { select: { name: true } },
      organization: { select: { name: true } },
    },
  });

  if (!trip) {
    return { success: false as const, error: "Trip not found" };
  }

  // Falls back to the phone number rather than refusing outright, and records
  // which number was actually used.
  const target = driverWhatsAppNumber(trip.driver);
  if (!target) {
    return {
      success: false as const,
      error: `${trip.driver.firstName} has no WhatsApp number or phone number on record.`,
    };
  }

  const outcome = await sendTripMessage({
    tripId: trip.id,
    organizationId: session.organizationId,
    driverId: trip.driver.id,
    driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
    phone: target.number,
    message: buildTripMessage(trip),
    trigger: "manual",
  });

  revalidatePath(`/operations/trips/${tripId}`);

  return outcome.status === "failed"
    ? { success: false as const, error: outcome.error }
    : { success: true as const };
}
