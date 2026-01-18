"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";
import { notifyEditRequestCreated, notifyEditRequestApproved, notifyEditRequestRejected } from "@/lib/notifications";

export async function createEditRequest(data: {
  entityType: string;
  entityId: string;
  reason: string;
  originalData: object;
  proposedData: object;
}) {
  const session = await requireAuth();

  try {
    const editRequest = await prisma.editRequest.create({
      data: {
        entityType: data.entityType,
        entityId: data.entityId,
        reason: data.reason,
        originalData: data.originalData,
        proposedData: data.proposedData,
        requestedById: session.user.id,
        status: "pending",
      },
    });

    // Send admin notification
    notifyEditRequestCreated(
      {
        id: editRequest.id,
        entityType: data.entityType,
        entityId: data.entityId,
        reason: data.reason,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/edit-requests");
    return { success: true, editRequest };
  } catch (error) {
    console.error("Failed to create edit request:", error);
    return { success: false, error: "Failed to create edit request" };
  }
}

// Helper function to apply edit to the actual entity
async function applyEditToEntity(entityType: string, entityId: string, proposedData: object) {
  const data = proposedData as Record<string, unknown>;
  
  switch (entityType) {
    case "truck":
      await prisma.truck.update({
        where: { id: entityId },
        data: {
          registrationNo: data.registrationNo as string | undefined,
          make: data.make as string | undefined,
          model: data.model as string | undefined,
          year: data.year as number | undefined,
          status: data.status as string | undefined,
          currentMileage: data.currentMileage as number | undefined,
          fuelType: data.fuelType as string | undefined,
          tankCapacity: data.tankCapacity as number | undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/fleet/trucks");
      break;

    case "driver":
      await prisma.driver.update({
        where: { id: entityId },
        data: {
          firstName: data.firstName as string | undefined,
          lastName: data.lastName as string | undefined,
          email: data.email as string | undefined,
          phone: data.phone as string | undefined,
          licenseNumber: data.licenseNumber as string | undefined,
          licenseExpiry: data.licenseExpiry ? new Date(data.licenseExpiry as string) : undefined,
          status: data.status as string | undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/fleet/drivers");
      break;

    case "trip":
      await prisma.trip.update({
        where: { id: entityId },
        data: {
          originCity: data.originCity as string | undefined,
          originAddress: data.originAddress as string | undefined,
          destinationCity: data.destinationCity as string | undefined,
          destinationAddress: data.destinationAddress as string | undefined,
          loadDescription: data.loadDescription as string | undefined,
          loadWeight: data.loadWeight as number | undefined,
          loadUnits: data.loadUnits as number | undefined,
          estimatedMileage: data.estimatedMileage as number | undefined,
          actualMileage: data.actualMileage as number | undefined,
          revenue: data.revenue as number | undefined,
          status: data.status as string | undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/operations/trips");
      break;

    case "expense":
      await prisma.expense.update({
        where: { id: entityId },
        data: {
          amount: data.amount as number | undefined,
          description: data.description as string | undefined,
          date: data.date ? new Date(data.date as string) : undefined,
          vendor: data.vendor as string | undefined,
          reference: data.reference as string | undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/finance/expenses");
      break;

    case "customer":
      await prisma.customer.update({
        where: { id: entityId },
        data: {
          name: data.name as string | undefined,
          email: data.email as string | undefined,
          phone: data.phone as string | undefined,
          address: data.address as string | undefined,
          city: data.city as string | undefined,
          contactPerson: data.contactPerson as string | undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/customers");
      break;

    case "invoice":
      await prisma.invoice.update({
        where: { id: entityId },
        data: {
          total: data.total as number | undefined,
          status: data.status as string | undefined,
          dueDate: data.dueDate ? new Date(data.dueDate as string) : undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/finance/invoices");
      break;

    case "employee":
      await prisma.employee.update({
        where: { id: entityId },
        data: {
          firstName: data.firstName as string | undefined,
          lastName: data.lastName as string | undefined,
          email: data.email as string | undefined,
          phone: data.phone as string | undefined,
          position: data.position as string | undefined,
          salary: data.salary as number | undefined,
          status: data.status as string | undefined,
          notes: data.notes as string | undefined,
        },
      });
      revalidatePath("/employees");
      break;

    default:
      throw new Error(`Unknown entity type: ${entityType}`);
  }
}

export async function approveEditRequest(id: string, reviewNotes?: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const editRequest = await prisma.editRequest.findFirst({
      where: { id },
      include: {
        requestedBy: true,
      },
    });

    if (!editRequest) {
      return { success: false, error: "Edit request not found" };
    }

    if (editRequest.status !== "pending") {
      return { success: false, error: "Edit request has already been reviewed" };
    }
    
    // Apply the edit to the actual entity
    await applyEditToEntity(
      editRequest.entityType,
      editRequest.entityId,
      editRequest.proposedData as object
    );

    // Update the edit request status
    const updatedRequest = await prisma.editRequest.update({
      where: { id },
      data: {
        status: "approved",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });

    // Send admin notification
    notifyEditRequestApproved(
      {
        id: editRequest.id,
        entityType: editRequest.entityType,
        entityId: editRequest.entityId,
        requestedBy: editRequest.requestedBy?.name || "Unknown",
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/edit-requests");
    return { success: true, editRequest: updatedRequest };
  } catch (error) {
    console.error("Failed to approve edit request:", error);
    return { success: false, error: "Failed to approve edit request" };
  }
}

export async function rejectEditRequest(id: string, rejectionReason?: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const editRequest = await prisma.editRequest.findFirst({
      where: { id },
      include: {
        requestedBy: true,
      },
    });

    if (!editRequest) {
      return { success: false, error: "Edit request not found" };
    }

    if (editRequest.status !== "pending") {
      return { success: false, error: "Edit request has already been reviewed" };
    }

    const updatedRequest = await prisma.editRequest.update({
      where: { id },
      data: {
        status: "rejected",
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason,
      },
    });

    // Send admin notification
    notifyEditRequestRejected(
      {
        id: editRequest.id,
        entityType: editRequest.entityType,
        entityId: editRequest.entityId,
        requestedBy: editRequest.requestedBy?.name || "Unknown",
        rejectionReason: rejectionReason,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/edit-requests");
    return { success: true, editRequest: updatedRequest };
  } catch (error) {
    console.error("Failed to reject edit request:", error);
    return { success: false, error: "Failed to reject edit request" };
  }
}
