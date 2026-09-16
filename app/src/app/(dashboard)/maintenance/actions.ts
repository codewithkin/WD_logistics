"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { notifyMaintenanceRequestFixed } from "@/lib/notifications";

export async function createMaintenanceRequest(data: {
  truckId: string;
  notes: string;
  date: Date;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const truck = await prisma.truck.findFirst({
      where: { id: data.truckId, organizationId: session.organizationId },
    });

    if (!truck) {
      return { success: false, error: "Truck not found" };
    }

    await prisma.maintenanceRequest.create({
      data: {
        organizationId: session.organizationId,
        truckId: data.truckId,
        notes: data.notes,
        date: data.date,
        status: "open",
        reportedById: session.user.id,
      },
    });

    revalidatePath("/maintenance");
    return { success: true };
  } catch (error) {
    console.error("Failed to create maintenance request:", error);
    return { success: false, error: "Failed to log maintenance issue" };
  }
}

export async function markMaintenanceRequestFixed(id: string, fixedNotes?: string) {
  const session = await requireRole(["admin", "supervisor", "workshop"]);

  try {
    const request = await prisma.maintenanceRequest.findFirst({
      where: { id, organizationId: session.organizationId },
      include: { truck: { select: { registrationNo: true } } },
    });

    if (!request) {
      return { success: false, error: "Maintenance request not found" };
    }

    if (request.status === "fixed") {
      return { success: false, error: "This request is already marked fixed" };
    }

    await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        status: "fixed",
        fixedById: session.user.id,
        fixedAt: new Date(),
        fixedNotes,
      },
    });

    notifyMaintenanceRequestFixed(
      { id: request.id, truckRegistrationNo: request.truck.registrationNo },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/maintenance");
    return { success: true };
  } catch (error) {
    console.error("Failed to mark maintenance request fixed:", error);
    return { success: false, error: "Failed to update maintenance request" };
  }
}

export async function getTrucksForMaintenance() {
  const session = await requireRole(["admin", "supervisor"]);

  return prisma.truck.findMany({
    where: { organizationId: session.organizationId },
    select: { id: true, registrationNo: true, make: true, model: true },
    orderBy: { registrationNo: "asc" },
  });
}
