"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAuth, requireRole } from "@/lib/session";
import { gateChange } from "@/lib/edit-requests/gate";
import { resolvePeriod, type PeriodInput } from "@/lib/period-range";
import { TripStatus } from "@/lib/types";
import { generateTripReportPDF, generateSingleTripReportPDF } from "@/lib/reports/pdf-report-generator";
import { notifyTripCreated, notifyTripUpdated, notifyTripDeleted } from "@/lib/notifications";


import { notifyDriverTripAssignment } from "@/lib/whatsapp-notifications";

export async function createTrip(data: {
  originCity: string;
  originAddress?: string;
  originLat?: number | null;
  originLng?: number | null;
  destinationCity: string;
  destinationAddress?: string;
  destinationLat?: number | null;
  destinationLng?: number | null;
  loadDescription?: string;
  loadWeight?: number | null;
  loadUnits?: number | null;
  estimatedMileage: number;
  actualMileage?: number | null;
  startOdometer?: number | null;
  endOdometer?: number | null;
  revenue: number;
  scheduledDate: Date;
  startDate?: Date | null;
  endDate?: Date | null;
  truckId: string;
  driverId: string;
  customerId?: string | null;
  notes?: string;
}) {
  const session = await requireRole(["admin", "supervisor"]);

  // Auto-determine status based on scheduled date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scheduledDay = new Date(data.scheduledDate);
  scheduledDay.setHours(0, 0, 0, 0);
  const status: TripStatus = scheduledDay <= today ? "in_progress" : "scheduled";

  try {
    // Get truck, driver, and customer for notification
    const [truck, driver, customer] = await Promise.all([
      prisma.truck.findUnique({ where: { id: data.truckId }, select: { registrationNo: true } }),
      prisma.driver.findUnique({ where: { id: data.driverId }, select: { firstName: true, lastName: true } }),
      data.customerId ? prisma.customer.findUnique({ where: { id: data.customerId }, select: { name: true } }) : null,
    ]);

    const trip = await prisma.trip.create({
      data: {
        originCity: data.originCity,
        originAddress: data.originAddress,
        originLat: data.originLat,
        originLng: data.originLng,
        destinationCity: data.destinationCity,
        destinationAddress: data.destinationAddress,
        destinationLat: data.destinationLat,
        destinationLng: data.destinationLng,
        loadDescription: data.loadDescription,
        loadWeight: data.loadWeight,
        loadUnits: data.loadUnits,
        estimatedMileage: data.estimatedMileage,
        actualMileage: data.actualMileage,
        startOdometer: data.startOdometer,
        endOdometer: data.endOdometer,
        revenue: data.revenue,
        status: status,
        scheduledDate: data.scheduledDate,
        startDate: data.startDate,
        endDate: data.endDate,
        truckId: data.truckId,
        driverId: data.driverId,
        customerId: data.customerId,
        notes: data.notes,
        organizationId: session.organizationId,
      },
    });

    // Update driver and truck status if trip is in progress
    if (status === "in_progress") {
      await prisma.driver.update({
        where: { id: data.driverId },
        data: { status: "active" },
      });
      await prisma.truck.update({
        where: { id: data.truckId },
        data: { status: "in_service" },
      });
    }

    // Tell the driver, and record whether it arrived. This used to be
    // fire-and-forget — the result was discarded and a tick logged either
    // way, which is exactly how a driver ends up saying "what message?".
    //
    // Awaited rather than floated, so the outcome can be returned to the form
    // and the user warned. sendTripMessage never throws, so the agent being
    // down still cannot stop a trip being created.
    const notifyOutcome = await sendTripMessageForTrip(
      trip.id,
      session.organizationId,
    );

    // Send admin notification
    notifyTripCreated(
      {
        id: trip.id,
        origin: data.originCity,
        destination: data.destinationCity,
        scheduledDate: data.scheduledDate,
        truckRegistration: truck?.registrationNo || "Unknown",
        driverName: driver ? `${driver.firstName} ${driver.lastName}` : "Unknown",
        customerName: customer?.name,
        revenue: data.revenue,
        status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/operations/trips");
    revalidatePath("/fleet/trucks");
    revalidatePath("/fleet/drivers");
    return { success: true, trip };
  } catch (error) {
    console.error("Failed to create trip:", error);
    return { success: false, error: "Failed to create trip" };
  }
}

export async function updateTrip(
  id: string,
  data: {
    originCity?: string;
    originAddress?: string;
    originLat?: number | null;
    originLng?: number | null;
    destinationCity?: string;
    destinationAddress?: string;
    destinationLat?: number | null;
    destinationLng?: number | null;
    loadDescription?: string;
    loadWeight?: number | null;
    loadUnits?: number | null;
    estimatedMileage?: number;
    actualMileage?: number | null;
    startOdometer?: number | null;
    endOdometer?: number | null;
    revenue?: number;
    status?: TripStatus;
    scheduledDate?: Date;
    startDate?: Date | null;
    endDate?: Date | null;
    truckId?: string;
    driverId?: string;
    customerId?: string | null;
    notes?: string;
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
    entityType: "trip",
    entityId: id,
    data: data as unknown as Record<string, unknown>,
    action: "update",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const trip = await prisma.trip.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        truck: { select: { registrationNo: true } },
        driver: { select: { firstName: true, lastName: true } },
        customer: { select: { name: true } },
      },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    const updatedTrip = await prisma.trip.update({
      where: { id },
      data,
      include: {
        truck: { select: { registrationNo: true } },
        driver: { select: { firstName: true, lastName: true } },
        customer: { select: { name: true } },
      },
    });

    // Handle status changes
    if (data.status && data.status !== trip.status) {
      if (data.status === "in_progress") {
        await prisma.driver.update({
          where: { id: data.driverId || trip.driverId },
          data: { status: "active" },
        });
        await prisma.truck.update({
          where: { id: data.truckId || trip.truckId },
          data: { status: "in_service" },
        });
      } else if (data.status === "completed" || data.status === "cancelled") {
        await prisma.driver.update({
          where: { id: data.driverId || trip.driverId },
          data: { status: "active" },
        });
        await prisma.truck.update({
          where: { id: data.truckId || trip.truckId },
          data: { status: "active" },
        });
      }
    }

    // Send admin notification
    notifyTripUpdated(
      {
        id: updatedTrip.id,
        origin: updatedTrip.originCity,
        destination: updatedTrip.destinationCity,
        scheduledDate: updatedTrip.scheduledDate,
        truckRegistration: updatedTrip.truck.registrationNo,
        driverName: `${updatedTrip.driver.firstName} ${updatedTrip.driver.lastName}`,
        customerName: updatedTrip.customer?.name,
        revenue: updatedTrip.revenue,
        status: updatedTrip.status,
      },
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/operations/trips");
    revalidatePath(`/operations/trips/${id}`);
    revalidatePath("/fleet/trucks");
    revalidatePath("/fleet/drivers");
    return { success: true, trip: updatedTrip };
  } catch (error) {
    console.error("Failed to update trip:", error);
    return { success: false, error: "Failed to update trip" };
  }
}

export async function deleteTrip(id: string,
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
    entityType: "trip",
    entityId: id,
    data: {},
    action: "delete",
    reason,
  });
  if (!gate.proceed) return gate.response;

  try {
    const trip = await prisma.trip.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        _count: {
          select: { tripExpenses: true },
        },
      },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    if (trip._count.tripExpenses > 0) {
      return {
        success: false,
        error: "Cannot delete trip with associated expenses",
      };
    }

    await prisma.trip.delete({ where: { id } });

    // Send admin notification
    notifyTripDeleted(
      trip.originCity,
      trip.destinationCity,
      session.organizationId,
      { name: session.user.name, email: session.user.email, role: session.role }
    ).catch((err) => console.error("Failed to send admin notification:", err));

    revalidatePath("/operations/trips");
    return { success: true };
  } catch (error) {
    console.error("Failed to delete trip:", error);
    return { success: false, error: "Failed to delete trip" };
  }
}

export async function exportTripsPDF(period?: PeriodInput) {
  // Prints revenue and balances, which canViewFinancialData reserves
  // for admin. This used to need only a session.
  const session = await requireRole(["admin"]);

  try {
    // Every trip ever run used to go into a PDF headed "this month".
    const range = resolvePeriod(period, "1m");

    const trips = await prisma.trip.findMany({
      where: {
        organizationId: session.organizationId,
        scheduledDate: { gte: range.from, lte: range.to },
      },
      include: {
        truck: { select: { registrationNo: true } },
        driver: { select: { firstName: true, lastName: true } },
      },
      orderBy: { scheduledDate: "desc" },
    });

    const analytics = {
      totalTrips: trips.length,
      completedTrips: trips.filter((t) => t.status === "completed").length,
      // Revenue counts completed work only, matching every screen.
      totalRevenue: trips
        .filter((t) => t.status === "completed")
        .reduce((sum, t) => sum + t.revenue, 0),
      totalMileage: trips.reduce((sum, t) => sum + (t.actualMileage || t.estimatedMileage), 0),
    };

    const now = new Date();

    const pdfBytes = generateTripReportPDF({
      trips: trips.map((t) => ({
        origin: t.originCity,
        destination: t.destinationCity,
        truck: t.truck.registrationNo,
        driver: `${t.driver.firstName} ${t.driver.lastName}`,
        status: t.status.replace("_", " "),
        revenue: t.revenue,
        date: t.scheduledDate,
      })),
      analytics,
      period: {
        startDate: range.from,
        endDate: range.to,
      },
    });

    const base64 = Buffer.from(pdfBytes).toString("base64");

    return {
      success: true,
      data: base64,
      filename: `trips-report-${now.toISOString().split("T")[0]}.pdf`,
      mimeType: "application/pdf",
    };
  } catch (error) {
    console.error("Failed to generate PDF:", error);
    return {
      success: false,
      error: "Failed to generate PDF report",
    };
  }
}

export async function exportSingleTripReport(tripId: string) {
  const session = await requireAuth();

  try {
    const trip = await prisma.trip.findFirst({
      where: { id: tripId, organizationId: session.organizationId },
      include: {
        truck: true,
        driver: true,
        customer: true,
        tripExpenses: {
          include: {
            expense: {
              include: {
                category: true,
              },
            },
          },
        },
        invoices: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            amountPaid: true,
            balance: true,
            status: true,
            isCredit: true,
            dueDate: true,
          },
        },
      },
    });

    if (!trip) {
      return { success: false, error: "Trip not found" };
    }

    // Format dates helper
    const formatDate = (date: Date | null) => {
      if (!date) return "N/A";
      return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
    };

    const totalExpenses = trip.tripExpenses.reduce((sum, te) => sum + te.expense.amount, 0);
    const tripInvoice = trip.invoices[0];
    const grossProfit = trip.revenue - totalExpenses;
    const netProfit = tripInvoice?.status === "paid" ? grossProfit : 0;

    const pdfBytes = generateSingleTripReportPDF({
      trip: {
        originCity: trip.originCity,
        originAddress: trip.originAddress || "N/A",
        destinationCity: trip.destinationCity,
        destinationAddress: trip.destinationAddress || "N/A",
        loadDescription: trip.loadDescription || "N/A",
        loadWeight: trip.loadWeight || 0,
        status: trip.status.replace("_", " "),
        scheduledDate: formatDate(trip.scheduledDate),
        startDate: formatDate(trip.startDate),
        endDate: formatDate(trip.endDate),
        truck: trip.truck.registrationNo,
        driver: `${trip.driver.firstName} ${trip.driver.lastName}`,
        customer: trip.customer?.name || "N/A",
      },
      financials: {
        revenue: trip.revenue,
        expenses: totalExpenses,
        grossProfit,
        netProfit,
        invoiceNumber: tripInvoice?.invoiceNumber || "N/A",
        invoiceStatus: tripInvoice?.status || "N/A",
        invoiceTotal: tripInvoice?.total || 0,
        invoicePaid: tripInvoice?.amountPaid || 0,
        invoiceBalance: tripInvoice?.balance || 0,
      },
      mileage: {
        estimated: trip.estimatedMileage,
        actual: trip.actualMileage || 0,
        startOdometer: trip.startOdometer || 0,
        endOdometer: trip.endOdometer || 0,
      },
      expenses: trip.tripExpenses.map((te) => ({
        date: formatDate(te.expense.date),
        category: te.expense.category?.name || "Other",
        description: te.expense.description || "",
        amount: te.expense.amount,
      })),
      notes: trip.notes || "",
    });

    return {
      success: true,
      pdfBase64: Buffer.from(pdfBytes).toString("base64"),
    };
  } catch (error) {
    console.error("Failed to export trip report:", error);
    return { success: false, error: "Failed to export trip report" };
  }
}



/**
 * Loads a freshly-created trip and sends its driver the assignment message.
 *
 * Kept here rather than inline so `createTrip` reads as one thing, and so the
 * message template is shared with the manual resend on the trip page.
 */
async function sendTripMessageForTrip(
  tripId: string,
  organizationId: string,
): Promise<{ status: string; error?: string }> {
  try {
    const { driverWhatsAppNumber, sendTripMessage } = await import(
      "@/lib/whatsapp/trip-messages"
    );
    const { buildTripMessage } = await import("./_lib/message-template");

    const trip = await prisma.trip.findFirst({
      where: { id: tripId, organizationId },
      include: {
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            whatsappNumber: true,
          },
        },
        truck: { select: { registrationNo: true } },
        customer: { select: { name: true } },
        organization: { select: { name: true } },
      },
    });

    if (!trip) return { status: "failed", error: "Trip not found" };

    const target = driverWhatsAppNumber(trip.driver);
    if (!target) {
      return {
        status: "skipped",
        error: `${trip.driver.firstName} has no WhatsApp or phone number on record.`,
      };
    }

    const outcome = await sendTripMessage({
      tripId: trip.id,
      organizationId,
      driverId: trip.driver.id,
      driverName: `${trip.driver.firstName} ${trip.driver.lastName}`,
      phone: target.number,
      message: buildTripMessage(trip),
      trigger: "auto",
    });

    return { status: outcome.status, error: outcome.error };
  } catch (error) {
    console.error("Failed to send the trip message:", error);
    return {
      status: "failed",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
