import "server-only";

/**
 * Recording which driver had which truck, and when.
 *
 * `Driver.assignedTruckId` only ever knew the present. It was written from
 * three separate places, none of which kept any history, so "what did this
 * driver earn while they had ABC 222" could not be answered at all — the
 * previous answer was overwritten every time somebody swapped a truck.
 *
 * Switching trucks is the event item 25 is built on, so it goes through one
 * function. All three old call sites, and the edit-request apply path, use
 * this; nothing else should write `assignedTruckId` directly.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

export type EndReason =
  | "reassigned"
  | "unassigned"
  | "driver_terminated"
  | "truck_decommissioned"
  | "backfill";

export interface SwitchResult {
  success: boolean;
  error?: string;
  /** What actually happened, for the timeline entry and the toast. */
  change?: {
    from: string | null;
    to: string | null;
    at: Date;
  };
}

type Tx = Prisma.TransactionClient;

/**
 * Moves a driver onto a truck, off one, or between two.
 *
 * Closes the driver's open assignment, closes any open assignment on the
 * incoming truck that belongs to somebody else, opens the new one, and
 * updates `Driver.assignedTruckId` — all in one transaction, because a
 * half-applied switch leaves two open rows and every snapshot after it
 * double-counts the overlap.
 *
 * `at` allows backdating, which matters because switches are usually entered
 * days after they happened. Callers restrict that to admins.
 */
export async function switchDriverTruck(
  tx: Tx,
  params: {
    organizationId: string;
    driverId: string;
    /** Null to take the driver off their truck entirely. */
    truckId: string | null;
    at?: Date;
    actorId?: string;
    reason?: EndReason;
  },
): Promise<SwitchResult> {
  const at = params.at ?? new Date();
  const reason = params.reason ?? (params.truckId ? "reassigned" : "unassigned");

  const driver = await tx.driver.findFirst({
    where: { id: params.driverId, organizationId: params.organizationId },
    select: { id: true, assignedTruckId: true },
  });
  if (!driver) {
    return { success: false, error: "Driver not found" };
  }

  if (params.truckId) {
    const truck = await tx.truck.findFirst({
      where: { id: params.truckId, organizationId: params.organizationId },
      select: { id: true },
    });
    if (!truck) {
      return { success: false, error: "Truck not found" };
    }
  }

  // Nothing to record if the driver is already on that truck.
  if (driver.assignedTruckId === params.truckId) {
    return { success: true, change: { from: null, to: null, at } };
  }

  // ---- Close the driver's current assignment ----
  const openForDriver = await tx.driverTruckAssignment.findFirst({
    where: { driverId: params.driverId, endDate: null },
    select: { id: true, truckId: true, startDate: true },
  });

  if (openForDriver) {
    // A backdated switch must not end before it began.
    if (at < openForDriver.startDate) {
      return {
        success: false,
        error:
          "That date is before this driver took the truck they are on. Pick a later date.",
      };
    }
    await tx.driverTruckAssignment.update({
      where: { id: openForDriver.id },
      data: { endDate: at, endedById: params.actorId, endReason: reason },
    });
  }

  // ---- Free the incoming truck from whoever else has it ----
  if (params.truckId) {
    const openForTruck = await tx.driverTruckAssignment.findFirst({
      where: { truckId: params.truckId, endDate: null },
      select: { id: true, driverId: true, startDate: true },
    });

    if (openForTruck && openForTruck.driverId !== params.driverId) {
      await tx.driverTruckAssignment.update({
        where: { id: openForTruck.id },
        data: {
          endDate: at < openForTruck.startDate ? openForTruck.startDate : at,
          endedById: params.actorId,
          endReason: "reassigned",
        },
      });
      // That driver no longer has a truck.
      await tx.driver.update({
        where: { id: openForTruck.driverId },
        data: { assignedTruckId: null },
      });
    }

    await tx.driverTruckAssignment.create({
      data: {
        organizationId: params.organizationId,
        driverId: params.driverId,
        truckId: params.truckId,
        startDate: at,
        startedById: params.actorId,
      },
    });
  }

  await tx.driver.update({
    where: { id: params.driverId },
    data: { assignedTruckId: params.truckId },
  });

  return {
    success: true,
    change: { from: driver.assignedTruckId, to: params.truckId, at },
  };
}

/** The convenience wrapper for callers that aren't already in a transaction. */
export async function switchDriverTruckStandalone(params: {
  organizationId: string;
  driverId: string;
  truckId: string | null;
  at?: Date;
  actorId?: string;
  reason?: EndReason;
}): Promise<SwitchResult> {
  return prisma.$transaction((tx) => switchDriverTruck(tx, params));
}

/**
 * Closes a driver's open assignment without giving them another truck — for
 * termination, and for a truck being decommissioned out from under them.
 */
export async function endDriverAssignment(
  tx: Tx,
  params: {
    organizationId: string;
    driverId: string;
    at?: Date;
    actorId?: string;
    reason: EndReason;
  },
): Promise<void> {
  await switchDriverTruck(tx, { ...params, truckId: null });
}

/** Closes whoever is on a truck, for decommissioning or deletion. */
export async function endTruckAssignment(
  tx: Tx,
  params: {
    organizationId: string;
    truckId: string;
    at?: Date;
    actorId?: string;
    reason: EndReason;
  },
): Promise<void> {
  const open = await tx.driverTruckAssignment.findFirst({
    where: { truckId: params.truckId, endDate: null },
    select: { id: true, driverId: true },
  });
  if (!open) return;

  await tx.driverTruckAssignment.update({
    where: { id: open.id },
    data: {
      endDate: params.at ?? new Date(),
      endedById: params.actorId,
      endReason: params.reason,
    },
  });
  await tx.driver.update({
    where: { id: open.driverId },
    data: { assignedTruckId: null },
  });
}

export interface AssignmentPeriod {
  id: string;
  truckId: string;
  registrationNo: string;
  startDate: Date;
  endDate: Date | null;
  endReason: string | null;
}

/** A driver's truck history, oldest first — the timeline on their page. */
export async function getDriverAssignments(
  organizationId: string,
  driverId: string,
): Promise<AssignmentPeriod[]> {
  const rows = await prisma.driverTruckAssignment.findMany({
    where: { organizationId, driverId },
    include: { truck: { select: { registrationNo: true } } },
    orderBy: { startDate: "asc" },
  });

  return rows.map((row) => ({
    id: row.id,
    truckId: row.truckId,
    registrationNo: row.truck.registrationNo,
    startDate: row.startDate,
    endDate: row.endDate,
    endReason: row.endReason,
  }));
}

/** The mirror view: every driver who has had this truck. */
export async function getTruckAssignments(
  organizationId: string,
  truckId: string,
): Promise<
  Array<{
    id: string;
    driverId: string;
    driverName: string;
    startDate: Date;
    endDate: Date | null;
  }>
> {
  const rows = await prisma.driverTruckAssignment.findMany({
    where: { organizationId, truckId },
    include: { driver: { select: { firstName: true, lastName: true } } },
    orderBy: { startDate: "desc" },
  });

  return rows.map((row) => ({
    id: row.id,
    driverId: row.driverId,
    driverName: `${row.driver.firstName} ${row.driver.lastName}`,
    startDate: row.startDate,
    endDate: row.endDate,
  }));
}
