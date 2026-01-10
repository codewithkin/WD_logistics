"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";

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

    revalidatePath("/edit-requests");
    return { success: true, editRequest };
  } catch (error) {
    console.error("Failed to create edit request:", error);
    return { success: false, error: "Failed to create edit request" };
  }
}

export async function approveEditRequest(id: string, rejectionReason?: string) {
  await requireRole(["admin", "supervisor"]);

  try {
    const editRequest = await prisma.editRequest.findFirst({
      where: { id },
    });

    if (!editRequest) {
      return { success: false, error: "Edit request not found" };
    }

    if (editRequest.status !== "pending") {
      return { success: false, error: "Edit request has already been reviewed" };
    }

    const session = await requireAuth();
    const updatedRequest = await prisma.editRequest.update({
      where: { id },
      data: {
        status: "approved",
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });

    revalidatePath("/edit-requests");
    return { success: true, editRequest: updatedRequest };
  } catch (error) {
    console.error("Failed to approve edit request:", error);
    return { success: false, error: "Failed to approve edit request" };
  }
}

export async function rejectEditRequest(id: string, rejectionReason?: string) {
  await requireRole(["admin", "supervisor"]);

  try {
    const editRequest = await prisma.editRequest.findFirst({
      where: { id },
    });

    if (!editRequest) {
      return { success: false, error: "Edit request not found" };
    }

    if (editRequest.status !== "pending") {
      return { success: false, error: "Edit request has already been reviewed" };
    }

    const session = await requireAuth();
    const updatedRequest = await prisma.editRequest.update({
      where: { id },
      data: {
        status: "rejected",
        approvedById: session.user.id,
        approvedAt: new Date(),
        rejectionReason,
      },
    });

    revalidatePath("/edit-requests");
    return { success: true, editRequest: updatedRequest };
  } catch (error) {
    console.error("Failed to reject edit request:", error);
    return { success: false, error: "Failed to reject edit request" };
  }
}
