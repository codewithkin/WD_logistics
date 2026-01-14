"use server";

import { prisma } from "@/lib/prisma";
import { generateTripProfitLossPDF } from "@/lib/reports/pdf-report-generator";

export async function exportTripProfitLossPDF(tripId: string): Promise<{
    success: boolean;
    data?: string;
    filename?: string;
    error?: string;
}> {
    try {
        // Fetch trip with all related data
        const trip = await prisma.trip.findUnique({
            where: { id: tripId },
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
