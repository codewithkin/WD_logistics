"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { TrailerStatus } from "@/lib/types";
import { notifyTrailerCreated, notifyTrailerUpdated, notifyTrailerDeleted } from "@/lib/notifications";
import { deleteFromR2, getKeyFromUrl } from "@/lib/r2";

/** Best-effort cleanup — a failed delete shouldn't fail the caller's action. */
async function cleanupR2Image(url: string | null | undefined) {
  if (!url) return;
  const key = await getKeyFromUrl(url);
  if (key) await deleteFromR2(key);
}

export async function createTrailer(data: {
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  status: TrailerStatus;
  type?: string;
  licenseNumber?: string;
  licenseExpiration?: string;
  image?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const existingTrailer = await prisma.trailer.findFirst({
      where: {
        registrationNo: data.registrationNo,
        organizationId: session.organizationId,
      },
    });

    if (existingTrailer) {
      return { success: false, error: "A trailer with this registration number already exists" };
    }

    const trailer = await prisma.trailer.create({
      data: {
        organizationId: session.organizationId,
        registrationNo: data.registrationNo,
        make: data.make,
        model: data.model,
        year: data.year,
        status: data.status,
        type: data.type,
        licenseNumber: data.licenseNumber,
        licenseExpiration: data.licenseExpiration ? new Date(data.licenseExpiration) : undefined,
        image: data.image,
        notes: data.notes,
      },
    });

    notifyTrailerCreated(
      {
        id: trailer.id,
        registrationNo: trailer.registrationNo,
        make: trailer.make,
        model: trailer.model,
        year: trailer.year,
        status: trailer.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/fleet/trailers");

    return { success: true, trailer };
  } catch (error) {
    console.error("Failed to create trailer:", error);
    return { success: false, error: "Failed to create trailer" };
  }
}

export async function updateTrailer(
  id: string,
  data: {
    registrationNo?: string;
    make?: string;
    model?: string;
    year?: number;
    status?: TrailerStatus;
    type?: string;
    licenseNumber?: string;
    licenseExpiration?: string;
    image?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const trailer = await prisma.trailer.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!trailer) {
      return { success: false, error: "Trailer not found" };
    }

    if (data.registrationNo && data.registrationNo !== trailer.registrationNo) {
      const existingTrailer = await prisma.trailer.findFirst({
        where: {
          registrationNo: data.registrationNo,
          organizationId: session.organizationId,
          NOT: { id },
        },
      });

      if (existingTrailer) {
        return { success: false, error: "A trailer with this registration number already exists" };
      }
    }

    const updatedTrailer = await prisma.trailer.update({
      where: { id },
      data: {
        ...data,
        licenseExpiration: data.licenseExpiration ? new Date(data.licenseExpiration) : undefined,
      },
    });

    // Clean up the old R2 object if the image was replaced or removed —
    // otherwise every re-upload leaves the previous file orphaned in the bucket.
    if (data.image !== undefined && trailer.image && trailer.image !== data.image) {
      cleanupR2Image(trailer.image).catch((err) => console.error("Failed to delete old trailer image:", err));
    }

    notifyTrailerUpdated(
      {
        id: updatedTrailer.id,
        registrationNo: updatedTrailer.registrationNo,
        make: updatedTrailer.make,
        model: updatedTrailer.model,
        year: updatedTrailer.year,
        status: updatedTrailer.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/fleet/trailers");
    revalidatePath(`/fleet/trailers/${id}`);
    return { success: true, trailer: updatedTrailer };
  } catch (error) {
    console.error("Failed to update trailer:", error);
    return { success: false, error: "Failed to update trailer" };
  }
}

export async function assignTruckToTrailer(trailerId: string, truckId: string | null) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const trailer = await prisma.trailer.findFirst({
      where: { id: trailerId, organizationId: session.organizationId },
    });

    if (!trailer) {
      return { success: false, error: "Trailer not found" };
    }

    if (truckId) {
      const truck = await prisma.truck.findFirst({
        where: { id: truckId, organizationId: session.organizationId },
      });

      if (!truck) {
        return { success: false, error: "Truck not found" };
      }

      // Unassign any trailer currently assigned to this truck
      await prisma.trailer.updateMany({
        where: { assignedTruckId: truckId },
        data: { assignedTruckId: null },
      });

      await prisma.trailer.update({
        where: { id: trailerId },
        data: { assignedTruckId: truckId },
      });
    } else {
      await prisma.trailer.update({
        where: { id: trailerId },
        data: { assignedTruckId: null },
      });
    }

    revalidatePath("/fleet/trailers");
    revalidatePath(`/fleet/trailers/${trailerId}`);
    revalidatePath("/fleet/trucks");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign truck:", error);
    return { success: false, error: "Failed to assign truck" };
  }
}

export async function getAvailableTrucks() {
  const session = await requireAuth();

  try {
    const trucks = await prisma.truck.findMany({
      where: {
        organizationId: session.organizationId,
        status: "active",
      },
      select: {
        id: true,
        registrationNo: true,
        make: true,
        model: true,
        assignedTrailer: { select: { id: true } },
      },
      orderBy: { registrationNo: "asc" },
    });

    return {
      success: true,
      trucks: trucks.map((t) => ({
        id: t.id,
        registrationNo: t.registrationNo,
        make: t.make,
        model: t.model,
        assignedTrailerId: t.assignedTrailer?.id ?? null,
      })),
    };
  } catch (error) {
    console.error("Failed to fetch trucks:", error);
    return { success: false, error: "Failed to fetch trucks", trucks: [] };
  }
}

export async function deleteTrailer(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const trailer = await prisma.trailer.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!trailer) {
      return { success: false, error: "Trailer not found" };
    }

    await prisma.trailer.delete({ where: { id } });

    cleanupR2Image(trailer.image).catch((err) => console.error("Failed to delete trailer image:", err));

    notifyTrailerDeleted(
      trailer.registrationNo,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/fleet/trailers");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete trailer:", error);
    return { success: false, error: "Failed to delete trailer" };
  }
}

export async function requestEditTrailer(trailerId: string) {
  const session = await requireAuth();

  try {
    const trailer = await prisma.trailer.findFirst({
      where: { id: trailerId, organizationId: session.organizationId },
    });

    if (!trailer) {
      return { success: false, error: "Trailer not found" };
    }

    const existingRequest = await prisma.editRequest.findFirst({
      where: {
        entityType: "trailer",
        entityId: trailerId,
        status: "pending",
      },
    });

    if (existingRequest) {
      return { success: false, error: "An edit request for this trailer is already pending" };
    }

    await prisma.editRequest.create({
      data: {
        entityType: "trailer",
        entityId: trailerId,
        reason: `Request to edit trailer: ${trailer.registrationNo}`,
        originalData: {},
        proposedData: {},
        status: "pending",
        requestedById: session.user.id,
      },
    });

    revalidatePath("/edit-requests");
    return { success: true };
  } catch (error) {
    console.error("Failed to create edit request:", error);
    return { success: false, error: "Failed to submit edit request" };
  }
}
