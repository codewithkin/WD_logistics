"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { TruckStatus } from "@/lib/types";
import { generateTruckReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyTruckCreated, notifyTruckUpdated, notifyTruckDeleted } from "@/lib/notifications";

export async function createTruck(data: {
  registrationNo: string;
  make: string;
  model: string;
  year: number;
  status: TruckStatus;
  currentMileage: number;
  fuelType?: string;
  tankCapacity?: number;
  image?: string;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const existingTruck = await prisma.truck.findFirst({
      where: {
        registrationNo: data.registrationNo,
        organizationId: session.organizationId,
      },
    });

    if (existingTruck) {
      return { success: false, error: "A truck with this registration number already exists" };
    }

    const truck = await prisma.truck.create({
      data: {
        organizationId: session.organizationId,
        registrationNo: data.registrationNo,
        make: data.make,
        model: data.model,
        year: data.year,
        status: data.status,
        currentMileage: data.currentMileage,
        fuelType: data.fuelType,
        tankCapacity: data.tankCapacity,
        image: data.image,
        notes: data.notes,
      },
    });

    // Send admin notification
    notifyTruckCreated(
      {
        id: truck.id,
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        status: truck.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/fleet/trucks");
    return { success: true, truck };
  } catch (error) {
    console.error("Failed to create truck:", error);
    return { success: false, error: "Failed to create truck" };
  }
}

export async function updateTruck(
  id: string,
  data: {
    registrationNo?: string;
    make?: string;
    model?: string;
    year?: number;
    status?: TruckStatus;
    currentMileage?: number;
    fuelType?: string;
    tankCapacity?: number;
    image?: string;
    notes?: string;
  }
) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const truck = await prisma.truck.findFirst({
      where: { id, organizationId: session.organizationId },
    });

    if (!truck) {
      return { success: false, error: "Truck not found" };
    }

    if (data.registrationNo && data.registrationNo !== truck.registrationNo) {
      const existingTruck = await prisma.truck.findFirst({
        where: {
          registrationNo: data.registrationNo,
          organizationId: session.organizationId,
          NOT: { id },
        },
      });

      if (existingTruck) {
        return { success: false, error: "A truck with this registration number already exists" };
      }
    }

    const updatedTruck = await prisma.truck.update({
      where: { id },
      data,
    });

    // Send admin notification
    notifyTruckUpdated(
      {
        id: updatedTruck.id,
        registrationNo: updatedTruck.registrationNo,
        make: updatedTruck.make,
        model: updatedTruck.model,
        year: updatedTruck.year,
        status: updatedTruck.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/fleet/trucks");
    revalidatePath(`/fleet/trucks/${id}`);
    return { success: true, truck: updatedTruck };
  } catch (error) {
    console.error("Failed to update truck:", error);
    return { success: false, error: "Failed to update truck" };
  }
}

export async function assignDriverToTruck(truckId: string, driverId: string | null) {
  const session = await requireRole(["admin", "supervisor"]);

  try {
    const truck = await prisma.truck.findFirst({
      where: { id: truckId, organizationId: session.organizationId },
    });

    if (!truck) {
      return { success: false, error: "Truck not found" };
    }

    // If assigning a new driver
    if (driverId) {
      const driver = await prisma.driver.findFirst({
        where: { id: driverId, organizationId: session.organizationId },
      });

      if (!driver) {
        return { success: false, error: "Driver not found" };
      }

      // Unassign any driver currently assigned to this truck
      await prisma.driver.updateMany({
        where: { assignedTruckId: truckId },
        data: { assignedTruckId: null },
      });

      // Assign the new driver to this truck
      await prisma.driver.update({
        where: { id: driverId },
        data: { assignedTruckId: truckId },
      });
    } else {
      // Unassign any driver from this truck
      await prisma.driver.updateMany({
        where: { assignedTruckId: truckId },
        data: { assignedTruckId: null },
      });
    }

    revalidatePath("/fleet/trucks");
    revalidatePath(`/fleet/trucks/${truckId}`);
    revalidatePath("/fleet/drivers");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign driver:", error);
    return { success: false, error: "Failed to assign driver" };
  }
}

export async function getAvailableDrivers() {
  const session = await requireAuth();

  try {
    const drivers = await prisma.driver.findMany({
      where: {
        organizationId: session.organizationId,
        status: "active",
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        assignedTruckId: true,
      },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return { success: true, drivers };
  } catch (error) {
    console.error("Failed to fetch drivers:", error);
    return { success: false, error: "Failed to fetch drivers", drivers: [] };
  }
}

export async function deleteTruck(id: string) {
  const session = await requireRole(["admin"]);

  try {
    const truck = await prisma.truck.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { trips: true },
        },
      },
    });

    if (!truck) {
      return { success: false, error: "Truck not found" };
    }

    if (truck._count.trips > 0) {
      return { success: false, error: "Cannot delete truck with associated trips" };
    }

    await prisma.truck.delete({ where: { id } });

    // Send admin notification
    notifyTruckDeleted(
      truck.registrationNo,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/fleet/trucks");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete truck:", error);
    return { success: false, error: "Failed to delete truck" };
  }
}

export async function requestEditTruck(truckId: string) {
  const session = await requireAuth();

  try {
    const truck = await prisma.truck.findFirst({
      where: { id: truckId, organizationId: session.organizationId },
    });

    if (!truck) {
      return { success: false, error: "Truck not found" };
    }

    const existingRequest = await prisma.editRequest.findFirst({
      where: {
        entityType: "truck",
        entityId: truckId,
        status: "pending",
      },
    });

    if (existingRequest) {
      return { success: false, error: "An edit request for this truck is already pending" };
    }

    await prisma.editRequest.create({
      data: {
        entityType: "truck",
        entityId: truckId,
        reason: `Request to edit truck: ${truck.registrationNo}`,
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

export async function exportTrucksPDF(options?: {
  truckIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  const session = await requireAuth();

  try {
    const startDate = options?.startDate || new Date(new Date().setMonth(new Date().getMonth() - 1));
    const endDate = options?.endDate || new Date();

    const whereClause: Record<string, unknown> = {
      organizationId: session.organizationId,
    };

    if (options?.truckIds && options.truckIds.length > 0) {
      whereClause.id = { in: options.truckIds };
    }

    const trucks = await prisma.truck.findMany({
      where: whereClause,
      include: {
        assignedDriver: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
        trips: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          select: {
            id: true,
            revenue: true,
          },
        },
        truckExpenses: {
          include: {
            expense: {
              select: {
                amount: true,
                date: true,
              },
            },
          },
        },
      },
      orderBy: { registrationNo: "asc" },
    });

    const truckData = trucks.map((truck) => {
      const totalRevenue = truck.trips.reduce((sum, t) => sum + t.revenue, 0);
      const totalExpenses = truck.truckExpenses.reduce((sum, te) => sum + te.expense.amount, 0);
      return {
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        status: truck.status,
        currentMileage: truck.currentMileage,
        fuelType: truck.fuelType || "N/A",
        assignedDriver: truck.assignedDriver
          ? `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}`
          : "Unassigned",
        trips: truck.trips.length,
        revenue: totalRevenue,
        expenses: totalExpenses,
        profitLoss: totalRevenue - totalExpenses,
      };
    });

    const analytics = {
      totalTrucks: trucks.length,
      activeTrucks: trucks.filter((t) => t.status === "active").length,
      trucksWithDriver: trucks.filter((t) => t.assignedDriver).length,
      totalMileage: trucks.reduce((sum, t) => sum + t.currentMileage, 0),
      totalTrips: trucks.reduce((sum, t) => sum + t.trips.length, 0),
      totalRevenue: truckData.reduce((sum, t) => sum + t.revenue, 0),
      totalExpenses: truckData.reduce((sum, t) => sum + t.expenses, 0),
      totalProfitLoss: truckData.reduce((sum, t) => sum + t.profitLoss, 0),
    };

    const pdfBytes = generateTruckReportPDF({
      trucks: truckData,
      analytics,
      period: { startDate, endDate },
    });

    return {
      success: true,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `truck-report-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export trucks PDF:", error);
    return { success: false, error: "Failed to generate PDF report" };
  }
}
