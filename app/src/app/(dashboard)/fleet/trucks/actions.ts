"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { resolvePeriod } from "@/lib/period-range";
import { earnedRevenueWhere } from "@/lib/metrics/revenue";
import { TruckStatus } from "@/lib/types";
import { generateTruckReportPDF, generateSingleTruckReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyTruckCreated, notifyTruckUpdated, notifyTruckDeleted } from "@/lib/notifications";
import { notifyAdminTruckCreated } from "@/lib/whatsapp-notifications";
import { deleteFromR2, getKeyFromUrl } from "@/lib/r2";
import type { ReminderDays } from "@/lib/expiry-reminders";
import { deleteExpiryReminders, replaceExpiryReminders } from "@/lib/expiry-reminders-server";

/** Best-effort cleanup — a failed delete shouldn't fail the caller's action. */
async function cleanupR2Image(url: string | null | undefined) {
  if (!url) return;
  const key = await getKeyFromUrl(url);
  if (key) await deleteFromR2(key);
}

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
  crossBorderInsuranceExpiration?: Date;
  crossBorderPermitExpiration?: Date;
  vehicleLicenseExpiration?: Date;
  certificateOfFitnessExpiration?: Date;
  reminders?: ReminderDays;
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

    const truck = await prisma.$transaction(async (tx) => {
      const created = await tx.truck.create({
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
          crossBorderInsuranceExpiration: data.crossBorderInsuranceExpiration,
          crossBorderPermitExpiration: data.crossBorderPermitExpiration,
          vehicleLicenseExpiration: data.vehicleLicenseExpiration,
          certificateOfFitnessExpiration: data.certificateOfFitnessExpiration,
        },
      });

      if (data.reminders) {
        await replaceExpiryReminders(tx, {
          organizationId: session.organizationId,
          entityType: "truck",
          entityId: created.id,
          reminders: data.reminders,
        });
      }

      return created;
    });

    // Send admin notification (email + in-app)
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

    // Send WhatsApp notification to admin
    notifyAdminTruckCreated(
      truck.id,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin WhatsApp notification:", err));

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
    crossBorderInsuranceExpiration?: Date;
    crossBorderPermitExpiration?: Date;
    vehicleLicenseExpiration?: Date;
    certificateOfFitnessExpiration?: Date;
    reminders?: ReminderDays;
  },
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "truck",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;
  const { reminders, ...truckData } = data;

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

    const updatedTruck = await prisma.$transaction(async (tx) => {
      const updated = await tx.truck.update({ where: { id }, data: truckData });
      if (reminders) {
        await replaceExpiryReminders(tx, {
          organizationId: session.organizationId,
          entityType: "truck",
          entityId: id,
          reminders,
        });
      }
      return updated;
    });

    // Clean up the old R2 object if the image was replaced or removed —
    // otherwise every re-upload leaves the previous file orphaned in the bucket.
    if (data.image !== undefined && truck.image && truck.image !== data.image) {
      cleanupR2Image(truck.image).catch((err) => console.error("Failed to delete old truck image:", err));
    }

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

export async function deleteTruck(id: string,
  /**
   * Why the change is wanted. Required for anyone but an admin, whose
   * edit becomes a request rather than a write — see lib/edit-requests.
   */
  reason?: string,
) {
  const session = await requireAuth();

  // Admins write directly; everyone else's change becomes a request an
  // admin accepts or refuses. Everything below runs either for an admin,
  // or while an approved request is being replayed.
  const gate = await gateChange({
    entityType: "truck",
    entityId: id,
    data: {},
    action: "delete",
    reason,
  });
  if (!gate.proceed) return gate.response;

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

    await prisma.$transaction(async (tx) => {
      await deleteExpiryReminders(tx, "truck", id);
      await tx.truck.delete({ where: { id } });
    });

    cleanupR2Image(truck.image).catch((err) => console.error("Failed to delete truck image:", err));

    // Send admin notification (email + in-app)
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

export async function exportTrucksPDF(options?: {
  truckIds?: string[];
  startDate?: Date;
  endDate?: Date;
}) {
  // This report is a profit-and-loss statement per truck, so it belongs to
  // whoever may see money. It used to need only a session.
  const session = await requireRole(["admin"]);

  try {
    const range = resolvePeriod(
      { from: options?.startDate, to: options?.endDate },
      "3m",
    );
    const startDate = range.from;
    const endDate = range.to;

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
        // Revenue matched the on-screen figure only by accident: trips were
        // picked by createdAt (when the row was typed in) rather than when
        // the work happened, and cancelled and scheduled trips counted too.
        // This is the same rule as lib/metrics/revenue.ts.
        trips: {
          where: earnedRevenueWhere(session.organizationId, startDate, endDate),
          select: {
            id: true,
            revenue: true,
          },
        },
        // Expenses were not period-filtered at all, so a one-month report
        // subtracted every cost the truck had ever incurred from one month of
        // revenue and reported the result as profit.
        truckExpenses: {
          where: {
            expense: { date: { gte: startDate, lte: endDate } },
          },
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

export async function exportSingleTruckReport(truckId: string, periodParams?: { period?: string; from?: string; to?: string }) {
  // A per-truck P&L; admin-only, like the rest of the financial exports.
  const session = await requireRole(["admin"]);

  // Import date range function dynamically
  const { getDateRangeFromParams } = await import("@/lib/period-utils");
  const dateRange = getDateRangeFromParams(periodParams || {}, "3m");

  try {
    const truck = await prisma.truck.findFirst({
      where: { id: truckId, organizationId: session.organizationId },
      include: {
        assignedDriver: true,
        trips: {
          where: {
            scheduledDate: {
              gte: dateRange.from,
              lte: dateRange.to,
            },
          },
          orderBy: { scheduledDate: "desc" },
          take: 20,
          include: {
            driver: true,
          },
        },
        truckExpenses: {
          where: {
            expense: {
              date: {
                gte: dateRange.from,
                lte: dateRange.to,
              },
            },
          },
          take: 10,
          include: {
            expense: {
              include: {
                category: true,
              },
            },
          },
        },
      },
    });

    if (!truck) {
      return { success: false, error: "Truck not found" };
    }

    // The tables above are capped at 20 trips and 10 expenses so the PDF stays
    // readable, but the totals must cover the whole period — they used to sum
    // the capped slices, so a busy truck's report understated both its revenue
    // and its costs, and the profit line was the difference of two wrong
    // numbers. These aggregates are un-truncated.
    const [totalTrips, completedTrips, inProgressTrips, revenueAgg, expenseRows] =
      await Promise.all([
        prisma.trip.count({
          where: {
            truckId,
            organizationId: session.organizationId,
            scheduledDate: { gte: dateRange.from, lte: dateRange.to },
          },
        }),
        prisma.trip.count({
          where: {
            truckId,
            organizationId: session.organizationId,
            status: "completed",
            scheduledDate: { gte: dateRange.from, lte: dateRange.to },
          },
        }),
        prisma.trip.count({
          where: {
            truckId,
            organizationId: session.organizationId,
            status: "in_progress",
            scheduledDate: { gte: dateRange.from, lte: dateRange.to },
          },
        }),
        // Completed trips only — the same definition the screens use.
        prisma.trip.aggregate({
          where: earnedRevenueWhere(
            session.organizationId,
            dateRange.from,
            dateRange.to,
            { truckId },
          ),
          _sum: { revenue: true },
        }),
        // The amount lives on Expense, not on the TruckExpense join row, and
        // `some` keeps an expense shared across two trucks counted once here
        // rather than once per link.
        prisma.expense.findMany({
          where: {
            organizationId: session.organizationId,
            date: { gte: dateRange.from, lte: dateRange.to },
            truckExpenses: { some: { truckId } },
          },
          select: { amount: true },
        }),
      ]);

    const totalRevenue = revenueAgg._sum.revenue ?? 0;
    const totalExpenses = expenseRows.reduce((sum, e) => sum + e.amount, 0);

    // Format dates helper
    const formatDate = (date: Date | null) => {
      if (!date) return "N/A";
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const pdfBytes = generateSingleTruckReportPDF({
      truck: {
        registrationNo: truck.registrationNo,
        make: truck.make,
        model: truck.model,
        year: truck.year,
        status: truck.status.replace("_", " "),
        currentMileage: truck.currentMileage,
        fuelType: truck.fuelType || "N/A",
        tankCapacity: truck.tankCapacity || 0,
        assignedDriver: truck.assignedDriver
          ? `${truck.assignedDriver.firstName} ${truck.assignedDriver.lastName}`
          : "Unassigned",
        notes: truck.notes || "",
      },
      stats: {
        totalTrips,
        completedTrips,
        inProgressTrips,
        totalRevenue,
        totalExpenses,
        profitLoss: totalRevenue - totalExpenses,
      },
      trips: truck.trips.map((trip) => ({
        route: `${trip.originCity} → ${trip.destinationCity}`,
        date: formatDate(trip.scheduledDate),
        status: trip.status.replace("_", " "),
        driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
      })),
      expenses: truck.truckExpenses.map((te) => ({
        date: formatDate(te.expense.date),
        type: te.expense.category?.name || "Other",
        amount: te.expense.amount,
        description: te.expense.description || "",
      })),
    });

    return {
      success: true,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    };
  } catch (error) {
    console.error("Failed to export truck report:", error);
    return { success: false, error: "Failed to export truck report" };
  }
}

