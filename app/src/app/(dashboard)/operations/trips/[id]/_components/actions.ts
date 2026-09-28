"use server";

import { prisma } from "@/lib/prisma";
import { assertRole } from "@/lib/session";
import { generateTripProfitLossPDF } from "@/lib/reports/pdf-report-generator";

/**
 * A trip's profit and loss, as a PDF.
 *
 * This had no guard of any kind and no organisation scope: a "use server"
 * export is a POST endpoint, so anyone who knew a trip id could take the
 * trip's revenue, its invoice and its margin without being signed in at all.
 * The card that calls it was admin-only, which is why it was never noticed —
 * a hidden button is not a permission check (ACCESS_CONTROL.md, "Where this
 * is enforced").
 */
export async function exportTripProfitLossPDF(tripId: string): Promise<{
    success: boolean;
    data?: string;
    filename?: string;
    error?: string;
}> {
    const session = await assertRole(["admin"]);

    try {
        // Fetch trip with all related data
        const trip = await prisma.trip.findFirst({
            where: { id: tripId, organizationId: session.organizationId },
            include: {
                truck: {
                    select: {
                        registrationNo: true,
                    },
                },
                driver: {
                    select: {
                        firstName: true,
                        lastName: true,
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
                    },
                    take: 1, // Get the first/main invoice for the trip
                },
                tripExpenses: {
                    include: {
                        expense: {
                            include: {
                                category: {
                                    select: {
                                        name: true,
                                    },
                                },
                            },
                        },
                    },
                },
            },
        });

        if (!trip) {
            return { success: false, error: "Trip not found" };
        }

        // Get the main invoice
        const tripInvoice = trip.invoices[0];

        // Calculate revenue
        const revenue = tripInvoice?.total ?? trip.revenue ?? 0;

        // Prepare expense data
        const expenses = trip.tripExpenses.map((te) => ({
            description: te.expense.description,
            category: te.expense.category?.name || null,
            date: te.expense.date,
            amount: te.expense.amount,
        }));

        // Generate PDF
        const pdfBuffer = generateTripProfitLossPDF({
            trip: {
                tripNumber: undefined, // No tripNumber field in schema
                origin: trip.originCity,
                destination: trip.destinationCity,
                startDate: trip.startDate || trip.scheduledDate,
                endDate: trip.endDate,
                status: trip.status,
                truck: trip.truck?.registrationNo || null,
                driver: trip.driver
                    ? `${trip.driver.firstName} ${trip.driver.lastName}`
                    : null,
            },
            expenses,
            invoice: tripInvoice
                ? {
                      invoiceNumber: tripInvoice.invoiceNumber,
                      total: tripInvoice.total,
                      amountPaid: tripInvoice.amountPaid,
                      balance: tripInvoice.balance,
                      status: tripInvoice.status,
                      isCredit: tripInvoice.isCredit,
                  }
                : null,
            revenue,
        });

        // Convert to base64
        const base64 = Buffer.from(pdfBuffer).toString("base64");

        // Generate filename
        const tripIdentifier = trip.id.slice(0, 8);
        const filename = `trip-${tripIdentifier}-profit-loss.pdf`;

        return {
            success: true,
            data: base64,
            filename,
        };
    } catch (error) {
        console.error("Error generating trip profit/loss PDF:", error);
        return {
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
        };
    }
}
