/**
 * The message a driver receives about a trip.
 *
 * Deliberately NOT in an actions.ts: a `"use server"` module may only export
 * async functions, and exporting a plain one throws at runtime rather than at
 * typecheck. Shared by the automatic send on trip creation and the manual
 * resend on the trip page, so the two cannot drift.
 */

import { format } from "date-fns";

/**
 * Builds the message a driver receives.
 *
 * Every field is checked before it goes in. The previous template
 * interpolated a trip number that does not exist in the schema, so every
 * message the system sent read "Trip undefined".
 */
export function buildTripMessage(trip: {
  originCity: string;
  destinationCity: string;
  scheduledDate: Date;
  loadDescription: string | null;
  truck: { registrationNo: string };
  driver: { firstName: string };
  customer: { name: string } | null;
  organization: { name: string } | null;
}): string {
  const lines = [
    `Hello ${trip.driver.firstName},`,
    "",
    `You have a trip scheduled for ${format(trip.scheduledDate, "EEEE d MMMM yyyy")}.`,
    "",
    `Route: ${trip.originCity} → ${trip.destinationCity}`,
    `Truck: ${trip.truck.registrationNo}`,
  ];

  if (trip.customer?.name) lines.push(`Customer: ${trip.customer.name}`);
  if (trip.loadDescription) lines.push(`Load: ${trip.loadDescription}`);

  lines.push("", `— ${trip.organization?.name ?? "WD Logistics"}`);
  return lines.join("\n");
}

