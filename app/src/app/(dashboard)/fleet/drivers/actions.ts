"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { DriverStatus } from "@/lib/types";

export async function createDriver(data: {
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  whatsappNumber?: string;
  licenseNumber: string;
  passportNumber?: string;
  status: DriverStatus;
  notes?: string;
  assignedTruckId?: string | null;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const existingDriver = await prisma.driver.findFirst({
      where: {
        licenseNumber: data.licenseNumber,
        organizationId: session.organizationId,
      },
    });

    if (existingDriver) {
      return { success: false, error: "A driver with this license number already exists" };
    }

    const driver = await prisma.driver.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        licenseNumber: data.licenseNumber,
        passportNumber: data.passportNumber,
        status: data.status,
        notes: data.notes,
        assignedTruckId: data.assignedTruckId,
        organizationId: session.organizationId,
      },
    });

    revalidatePath("/fleet/drivers");
    return { success: true, driver };
  } catch (error) {
    console.error("Failed to create driver:", error);
    return { success: false, error: "Failed to create driver" };
  }
}

export async function updateDriver(
  id: string,
  data: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    whatsappNumber?: string;
    licenseNumber?: string;
    passportNumber?: string;
    status?: DriverStatus;
    notes?: string;
    assignedTruckId?: string | null;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const driver = await prisma.driver.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!driver) {
      return { success: false, error: "Driver not found" };
    }

    if (data.licenseNumber && data.licenseNumber !== driver.licenseNumber) {
      const existingDriver = await prisma.driver.findFirst({
        where: {
          licenseNumber: data.licenseNumber,
          organizationId: session.organizationId,
          NOT: { id },
        },
      });

      if (existingDriver) {
        return { success: false, error: "A driver with this license number already exists" };
      }
    }

    // Handle truck assignment
    if (data.assignedTruckId !== undefined) {
      // Unassign from old truck if changing
      if (driver.assignedTruckId && driver.assignedTruckId !== data.assignedTruckId) {
        // Note: We don't update the Truck model since it doesn't have assignedDriverId
        // This is handled by the unique constraint on Driver.assignedTruckId
      }

      // Unassign any other driver from the new truck first
      if (data.assignedTruckId) {
        await prisma.driver.updateMany({
          where: { assignedTruckId: data.assignedTruckId, NOT: { id } },
          data: { assignedTruckId: null },
        });
      }
    }

    const updatedDriver = await prisma.driver.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        licenseNumber: data.licenseNumber,
        passportNumber: data.passportNumber,
        status: data.status,
        notes: data.notes,
        assignedTruckId: data.assignedTruckId,
      },
    });

    revalidatePath("/fleet/drivers");
    revalidatePath(`/fleet/drivers/${id}`);
    revalidatePath("/fleet/trucks");
    return { success: true, driver: updatedDriver };
  } catch (error) {
    console.error("Failed to update driver:", error);
    return { success: false, error: "Failed to update driver" };
  }
}

export async function deleteDriver(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const driver = await prisma.driver.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { trips: true },
        },
      },
    });

    if (!driver) {
      return { success: false, error: "Driver not found" };
    }

    if (driver._count.trips > 0) {
      return { success: false, error: "Cannot delete driver with associated trips" };
    }

    // Unassign from truck if any
    if (driver.assignedTruckId) {
      await prisma.truck.update({
        where: { id: driver.assignedTruckId },
        data: { assignedDriver: { disconnect: true } },
      });
    }

    await prisma.driver.delete({ where: { id } });

    revalidatePath("/fleet/drivers");
    revalidatePath("/fleet/trucks");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete driver:", error);
    return { success: false, error: "Failed to delete driver" };
  }
}

export async function assignTruckToDriver(driverId: string, truckId: string | null) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const driver = await prisma.driver.findFirst({
      where: { id: driverId, organizationId: session.organizationId },
    });

    if (!driver) {
      return { success: false, error: "Driver not found" };
    }

    if (truckId) {
      const truck = await prisma.truck.findFirst({
        where: { id: truckId, organizationId: session.organizationId },
      });

      if (!truck) {
        return { success: false, error: "Truck not found" };
      }

      // Unassign any driver currently assigned to this truck
      await prisma.driver.updateMany({
        where: { assignedTruckId: truckId, NOT: { id: driverId } },
        data: { assignedTruckId: null },
      });
    }

    // Update the driver's assigned truck
    await prisma.driver.update({
      where: { id: driverId },
      data: { assignedTruckId: truckId },
    });

    revalidatePath("/fleet/drivers");
    revalidatePath(`/fleet/drivers/${driverId}`);
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
        assignedDriver: {
          select: { id: true },
        },
      },
      orderBy: { registrationNo: "asc" },
    });

    return { success: true, trucks };
  } catch (error) {
    console.error("Failed to fetch trucks:", error);
    return { success: false, error: "Failed to fetch trucks", trucks: [] };
  }
}

export async function requestEditDriver(driverId: string) {
  const session = await requireAuth();

  try {
    const driver = await prisma.driver.findFirst({
      where: { id: driverId, organizationId: session.organizationId },
    });

    if (!driver) {
      return { success: false, error: "Driver not found" };
    }

    const existingRequest = await prisma.editRequest.findFirst({
      where: {
        entityType: "driver",
        entityId: driverId,
        status: "pending",
      },
    });

    if (existingRequest) {
      return { success: false, error: "An edit request for this driver is already pending" };
    }

    await prisma.editRequest.create({
      data: {
        entityType: "driver",
        entityId: driverId,
        reason: `Request to edit driver: ${driver.firstName} ${driver.lastName}`,
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
