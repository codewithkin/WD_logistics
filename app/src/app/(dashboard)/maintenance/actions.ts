"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertRole, requireRole } from "@/lib/session";
import {
  notifyMaintenanceRequestAssigned,
  notifyMaintenanceRequestFixed,
  notifyMaintenanceRequestUpdated,
} from "@/lib/notifications";
import { handleActionError } from "@/lib/error-messages";

// Types and constants live in ./_lib/status — a "use server" module may only
// export async functions, and re-exporting even a type from here breaks the
// build ("Export MaintenanceVehicleType doesn't exist in target module").
import type { MaintenanceVehicleType } from "./_lib/status";

interface MaintenanceVehicle {
  truckId: string | null;
  trailerId: string | null;
  label: string;
}

/**
 * Resolves the vehicle a job targets and checks it belongs to the caller's
 * organization. Returns the label used in notifications ("ABC 1234"), so the
 * caller never has to re-query just to name the thing.
 */
async function resolveVehicle(
  vehicleType: MaintenanceVehicleType,
  vehicleId: string,
  organizationId: string,
): Promise<MaintenanceVehicle | null> {
  if (vehicleType === "truck") {
    const truck = await prisma.truck.findFirst({
      where: { id: vehicleId, organizationId },
      select: { id: true, registrationNo: true },
    });
    if (!truck) return null;
    return { truckId: truck.id, trailerId: null, label: `Truck ${truck.registrationNo}` };
  }

  const trailer = await prisma.trailer.findFirst({
    where: { id: vehicleId, organizationId },
    select: { id: true, registrationNo: true },
  });
  if (!trailer) return null;
  return { truckId: null, trailerId: trailer.id, label: `Trailer ${trailer.registrationNo}` };
}

function vehicleLabel(request: {
  truck: { registrationNo: string } | null;
  trailer: { registrationNo: string } | null;
}): string {
  if (request.truck) return `Truck ${request.truck.registrationNo}`;
  if (request.trailer) return `Trailer ${request.trailer.registrationNo}`;
  return "Vehicle removed";
}

/**
 * Only members with the workshop role can be assigned a job. Kept here rather
 * than inlined so the create form, the assign dialog and the validation below
 * all read the same list.
 */
export async function getWorkshopMembers() {
  const session = await requireRole(["admin", "supervisor"]);

  const members = await prisma.member.findMany({
    where: { organizationId: session.organizationId, role: "workshop" },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { createdAt: "asc" },
  });

  return members.map((m) => ({ id: m.user.id, name: m.user.name, email: m.user.email }));
}

export async function createMaintenanceRequest(data: {
  vehicleType: MaintenanceVehicleType;
  vehicleId: string;
  notes: string;
  date: Date;
  assignedToId?: string | null;
}) {
  try {
    const session = await assertRole(["admin", "supervisor"]);

    const vehicle = await resolveVehicle(data.vehicleType, data.vehicleId, session.organizationId);
    if (!vehicle) {
      return { success: false, error: "That vehicle no longer exists." };
    }

    if (!data.notes.trim()) {
      return { success: false, error: "Describe the issue before logging it." };
    }

    const assignedToId = await validateAssignee(data.assignedToId, session.organizationId);
    if (assignedToId === "invalid") {
      return { success: false, error: "That person isn't a workshop user." };
    }

    const request = await prisma.maintenanceRequest.create({
      data: {
        organizationId: session.organizationId,
        truckId: vehicle.truckId,
        trailerId: vehicle.trailerId,
        notes: data.notes.trim(),
        date: data.date,
        status: assignedToId ? "assigned" : "open",
        reportedById: session.user.id,
        assignedToId: assignedToId ?? null,
        assignedById: assignedToId ? session.user.id : null,
        assignedAt: assignedToId ? new Date() : null,
      },
    });

    if (assignedToId) {
      notifyMaintenanceRequestAssigned(
        {
          id: request.id,
          vehicleLabel: vehicle.label,
          notes: request.notes,
          date: request.date,
          assignedToId,
        },
        session.organizationId,
        { name: session.user.name, email: session.user.email, role: session.role },
      ).catch((err) => console.error("Failed to notify assignee:", err));
    }

    revalidatePath("/maintenance");
    return { success: true, id: request.id };
  } catch (error) {
    return handleActionError(error, "Failed to log this maintenance issue.", "Failed to create maintenance request");
  }
}

/** Returns the id, null for "unassign", or the string "invalid". */
async function validateAssignee(
  assignedToId: string | null | undefined,
  organizationId: string,
): Promise<string | null | "invalid"> {
  if (!assignedToId) return null;

  const member = await prisma.member.findFirst({
    where: { organizationId, userId: assignedToId, role: "workshop" },
    select: { id: true },
  });

  return member ? assignedToId : "invalid";
}

export async function assignMaintenanceRequest(id: string, assignedToId: string | null) {
  try {
    const session = await assertRole(["admin", "supervisor"]);

    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        truck: { select: { registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
    });

    if (!request) return { success: false, error: "Maintenance request not found." };
    if (request.status === "fixed") {
      return { success: false, error: "This job is already done — reopen it first." };
    }

    const validated = await validateAssignee(assignedToId, session.organizationId);
    if (validated === "invalid") {
      return { success: false, error: "That person isn't a workshop user." };
    }

    await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        assignedToId: validated,
        assignedById: validated ? session.user.id : null,
        assignedAt: validated ? new Date() : null,
        // Going back to unassigned means nobody has picked it up again.
        status: validated ? (request.status === "open" ? "assigned" : request.status) : "open",
      },
    });

    if (validated) {
      notifyMaintenanceRequestAssigned(
        {
          id: request.id,
          vehicleLabel: vehicleLabel(request),
          notes: request.notes,
          date: request.date,
          assignedToId: validated,
          previousAssigneeId: request.assignedToId,
        },
        session.organizationId,
        { name: session.user.name, email: session.user.email, role: session.role },
      ).catch((err) => console.error("Failed to notify assignee:", err));
    }

    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${id}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error, "Failed to assign this job.", "Failed to assign maintenance request");
  }
}

/** Workshop marks a job as started, so the office can see it's under way. */
export async function startMaintenanceWork(id: string) {
  try {
    const session = await assertRole(["admin", "supervisor", "workshop"]);

    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        truck: { select: { registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
    });

    if (!request) return { success: false, error: "Maintenance request not found." };
    if (request.status === "fixed") {
      return { success: false, error: "This job is already marked fixed." };
    }
    if (session.role === "workshop" && request.assignedToId !== session.user.id) {
      return { success: false, error: "This job isn't assigned to you." };
    }

    await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: "in_progress",
        // Workshop picking up an unassigned job takes ownership of it.
        assignedToId: request.assignedToId ?? (session.role === "workshop" ? session.user.id : null),
      },
    });

    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${id}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error, "Failed to update this job.", "Failed to start maintenance work");
  }
}

export async function markMaintenanceRequestFixed(id: string, fixedNotes: string) {
  try {
    const session = await assertRole(["admin", "supervisor", "workshop"]);

    // The fix note is the record of what was actually done to the vehicle, and
    // the thing the office reads later — an empty one makes the whole job log
    // useless, so it's required rather than optional.
    const notes = fixedNotes?.trim() ?? "";
    if (notes.length < 5) {
      return {
        success: false,
        error: "Say what you did to fix it (at least a few words) before closing the job.",
      };
    }

    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        truck: { select: { registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
    });

    if (!request) {
      return { success: false, error: "Maintenance request not found." };
    }

    if (request.status === "fixed") {
      return { success: false, error: "This request is already marked fixed." };
    }

    if (session.role === "workshop" && request.assignedToId !== session.user.id) {
      return { success: false, error: "This job isn't assigned to you." };
    }

    await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: "fixed",
        fixedById: session.user.id,
        fixedAt: new Date(),
        fixedNotes: notes,
      },
    });

    notifyMaintenanceRequestFixed(
      {
        id: request.id,
        vehicleLabel: vehicleLabel(request),
        fixedNotes: notes,
        reportedById: request.reportedById,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role },
    ).catch((err) => console.error("Failed to send fixed notification:", err));

    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${id}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error, "Failed to close this job.", "Failed to mark maintenance request fixed");
  }
}

/** Admin/supervisor edit of the job itself (notes, date, vehicle). */
export async function updateMaintenanceRequest(
  id: string,
  data: { notes: string; date: Date },
) {
  try {
    const session = await assertRole(["admin", "supervisor"]);

    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        truck: { select: { registrationNo: true } },
        trailer: { select: { registrationNo: true } },
      },
    });

    if (!request) return { success: false, error: "Maintenance request not found." };
    if (!data.notes.trim()) return { success: false, error: "The issue description can't be empty." };

    await prisma.maintenanceRequest.update({
      where: { id },
      data: { notes: data.notes.trim(), date: data.date },
    });

    if (request.assignedToId && request.status !== "fixed") {
      notifyMaintenanceRequestUpdated(
        {
          id: request.id,
          vehicleLabel: vehicleLabel(request),
          assignedToId: request.assignedToId,
          summary: "the job details changed",
        },
        session.organizationId,
        { name: session.user.name, email: session.user.email, role: session.role },
      ).catch((err) => console.error("Failed to notify assignee:", err));
    }

    revalidatePath("/maintenance");
    revalidatePath(`/maintenance/${id}`);
    return { success: true };
  } catch (error) {
    return handleActionError(error, "Failed to update this job.", "Failed to update maintenance request");
  }
}

/** Trucks and trailers a job can be logged against. */
export async function getMaintenanceVehicles() {
  const session = await requireRole(["admin", "supervisor"]);

  const [trucks, trailers] = await Promise.all([
    prisma.truck.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, registrationNo: true, make: true, model: true },
      orderBy: { registrationNo: "asc" },
    }),
    prisma.trailer.findMany({
      where: { organizationId: session.organizationId },
      select: { id: true, registrationNo: true, make: true, model: true },
      orderBy: { registrationNo: "asc" },
    }),
  ]);

  return {
    trucks: trucks.map((t) => ({ ...t, vehicleType: "truck" as const })),
    trailers: trailers.map((t) => ({ ...t, vehicleType: "trailer" as const })),
  };
}
