"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, requireAuth } from "@/lib/session";

export async function createEditRequest(data: {
  entityType: string;
  entityId: string;
  description: string;
}) {
  const session = await requireAuth();

  try {
    const editRequest = await prisma.editRequest.create({
      data: {
        ...data,
        requestedById: session.userId,
        organizationId: session.organizationId,
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

export async function approveEditRequest(id: string, reviewNotes?: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const editRequest = await prisma.editRequest.findFirst({
      where: { id, organizationId: session.organizationId },
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
        status: "approved",
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    revalidatePath("/edit-requests");
    return { success: true, editRequest: updatedRequest };
  } catch (error) {
    console.error("Failed to approve edit request:", error);
    return { success: false, error: "Failed to approve edit request" };
  }
}

export async function rejectEditRequest(id: string, reviewNotes?: string) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const editRequest = await prisma.editRequest.findFirst({
      where: { id, organizationId: session.organizationId },
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
        reviewedById: session.userId,
        reviewedAt: new Date(),
        reviewNotes,
      },
    });

    revalidatePath("/edit-requests");
    return { success: true, editRequest: updatedRequest };
  } catch (error) {
    console.error("Failed to reject edit request:", error);
    return { success: false, error: "Failed to reject edit request" };
  }
}
