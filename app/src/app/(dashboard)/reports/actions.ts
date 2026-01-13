"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { z } from "zod";
import {
  fetchProfitPerUnitData,
  fetchRevenueData,
  fetchExpenseData,
  fetchCustomerStatementData,
  fetchTripSummaryData,
  getCustomerList,
  getTruckList,
} from "@/lib/reports/data-fetchers";
import {
  generateProfitPerUnitCSV,
  generateRevenueCSV,
  generateExpenseCSV,
  generateCustomerStatementCSV,
  generateTripSummaryCSV,
} from "@/lib/reports/csv-generator";
import {
  generateProfitPerUnitPDF,
  generateRevenueReportPDF,
  generateExpenseReportPDF,
  generateTripSummaryPDF,
  generateCustomerStatementPDF,
  generateDashboardSummaryPDF,
} from "@/lib/reports/pdf-report-generator";

// Input validation schema
const generateReportSchema = z.object({
  reportType: z.enum([
    "profit-per-unit",
    "revenue",
    "expenses",
    "customer-statement",
    "trip-summary",
  ]),
  startDate: z.string(),
  endDate: z.string(),
  period: z.string(),
  format: z.enum(["pdf", "csv"]),
  customerId: z.string().optional(),
  truckId: z.string().optional(),
});

export type GenerateReportInput = z.infer<typeof generateReportSchema>;

export interface GenerateReportResult {
  success: boolean;
  data?: string; // Base64 encoded file data
  filename?: string;
  mimeType?: string;
  error?: string;
  reportId?: string;
}

/**
 * Generate a report based on type and parameters
 */
export async function generateReport(
  input: GenerateReportInput
): Promise<GenerateReportResult> {
  try {
    const session = await requireRole(["admin"]);
    const { organizationId } = session;

    const validated = generateReportSchema.parse(input);
    const { reportType, startDate, endDate, period, format, customerId } = validated;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodObj = { startDate: start, endDate: end };

    let fileBuffer: Buffer | Uint8Array;
    let mimeType: string;
    let fileExtension: string;
    let filename: string;

    switch (reportType) {
      case "profit-per-unit": {
        const data = await fetchProfitPerUnitData(organizationId, start, end);

        if (format === "pdf") {
          const pdfBytes = generateProfitPerUnitPDF({
            trucks: data,
            period: periodObj,
          });
          fileBuffer = pdfBytes;
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const meta = {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            period,
            generatedAt: new Date(),
          };
          const csvContent = generateProfitPerUnitCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `profit-per-unit-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      case "revenue": {
        const data = await fetchRevenueData(organizationId, start, end);
        
        if (format === "pdf") {
          const pdfBytes = generateRevenueReportPDF({
            items: data,
            period: periodObj,
          });
          fileBuffer = pdfBytes;
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const meta = {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            period,
            generatedAt: new Date(),
          };
          const csvContent = generateRevenueCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `revenue-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      case "expenses": {
        const data = await fetchExpenseData(organizationId, start, end);

        if (format === "pdf") {
          const pdfBytes = generateExpenseReportPDF({
            expenses: data.map((e) => ({
              date: e.date,
              category: e.category,
              description: e.description,
              amount: e.amount,
              trucks: e.truck ? [e.truck] : [],
              trips: e.trip ? [e.trip] : [],
            })),
            period: periodObj,
          });
          fileBuffer = pdfBytes;
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const meta = {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            period,
            generatedAt: new Date(),
          };
          const csvContent = generateExpenseCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `expenses-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      case "customer-statement": {
        if (!customerId) {
          return { success: false, error: "Customer ID is required for customer statement" };
        }

        const statementData = await fetchCustomerStatementData(
          organizationId,
          customerId,
          start,
          end
        );

        if (format === "pdf") {
          const pdfBytes = generateCustomerStatementPDF({
            customer: statementData.customer,
            entries: statementData.entries,
            openingBalance: statementData.openingBalance,
            closingBalance: statementData.closingBalance,
            period: periodObj,
          });
          fileBuffer = pdfBytes;
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const meta = {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            period,
            generatedAt: new Date(),
            customerName: statementData.customer.name,
          };
          const csvContent = generateCustomerStatementCSV(
            statementData.entries,
            meta,
            statementData.openingBalance,
            statementData.closingBalance
          );
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `statement-${statementData.customer.name.replace(/\s+/g, "-")}-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      case "trip-summary": {
        const data = await fetchTripSummaryData(organizationId, start, end);

        if (format === "pdf") {
          const pdfBytes = generateTripSummaryPDF({
            trips: data.map((t) => ({
              tripNumber: t.tripNumber,
              date: t.date,
              origin: t.origin,
              destination: t.destination,
              truck: t.truck,
              driver: t.driver,
              revenue: t.revenue,
              expenses: t.expenses,
              profit: t.profit,
            })),
            period: periodObj,
          });
          fileBuffer = pdfBytes;
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const meta = {
            startDate: start.toISOString().split("T")[0],
            endDate: end.toISOString().split("T")[0],
            period,
            generatedAt: new Date(),
          };
          const csvContent = generateTripSummaryCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `trip-summary-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      default:
        return { success: false, error: "Invalid report type" };
    }

    // Save report record to database
    const report = await prisma.report.create({
      data: {
        organizationId,
        type: reportType.replace(/-/g, "_"),
        period,
        startDate: start,
        endDate: end,
        format,
        generatedById: session.user.id,
      },
    });

    // Convert buffer to base64 for client download
    const base64Data = Buffer.from(fileBuffer).toString("base64");

    return {
      success: true,
      data: base64Data,
      filename,
      mimeType,
      reportId: report.id,
    };
  } catch (error) {
    console.error("Error generating report:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate report",
    };
  }
}

/**
 * Get report history for the organization
 */
export async function getReportHistory(limit: number = 20) {
  const session = await requireRole(["admin"]);
  const { organizationId } = session;

  const reports = await prisma.report.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return reports;
}

/**
 * Get customers for the dropdown in customer statement report
 */
export async function getCustomersForReport() {
  const session = await requireRole(["admin"]);
  return getCustomerList(session.organizationId);
}

/**
 * Get trucks for the dropdown in truck performance report
 */
export async function getTrucksForReport() {
  const session = await requireRole(["admin"]);
  return getTruckList(session.organizationId);
}

/**
 * Delete a report record
 */
export async function deleteReport(reportId: string) {
  const session = await requireRole(["admin"]);
  const { organizationId } = session;

  const report = await prisma.report.findFirst({
    where: { id: reportId, organizationId },
  });

  if (!report) {
    return { success: false, error: "Report not found" };
  }

  await prisma.report.delete({
    where: { id: reportId },
  });

  return { success: true };
}

/**
 * Export dashboard summary as PDF
 */
export async function exportDashboardPDF() {
  const session = await requireRole(["admin"]);
  const { organizationId } = session;

  try {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    // Fetch fleet data
    const [totalTrucks, activeTrucks, totalDrivers, activeDrivers] = await Promise.all([
      prisma.truck.count({ where: { organizationId } }),
      prisma.truck.count({ where: { organizationId, status: "active" } }),
      prisma.driver.count({ where: { organizationId } }),
      prisma.driver.count({ where: { organizationId, status: "active" } }),
    ]);

    // Fetch trip data
    const [thisMonthTrips, lastMonthTrips, completedTrips, inProgressTrips] = await Promise.all([
      prisma.trip.count({
        where: {
          organizationId,
          scheduledDate: { gte: thisMonthStart, lte: thisMonthEnd },
        },
      }),
      prisma.trip.count({
        where: {
          organizationId,
          scheduledDate: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      prisma.trip.count({
        where: { organizationId, status: "completed" },
      }),
      prisma.trip.count({
        where: { organizationId, status: "in_progress" },
      }),
    ]);

    // Fetch financial data
    const [
      thisMonthInvoices,
      lastMonthInvoices,
      thisMonthPayments,
      lastMonthPayments,
      thisMonthExpenses,
      lastMonthExpenses,
    ] = await Promise.all([
      prisma.invoice.aggregate({
        where: {
          organizationId,
          issueDate: { gte: thisMonthStart, lte: thisMonthEnd },
        },
        _sum: { total: true },
      }),
      prisma.invoice.aggregate({
        where: {
          organizationId,
          issueDate: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { total: true },
      }),
      prisma.payment.aggregate({
        where: {
          invoice: { organizationId },
          paymentDate: { gte: thisMonthStart, lte: thisMonthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: {
          invoice: { organizationId },
          paymentDate: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId,
          date: { gte: thisMonthStart, lte: thisMonthEnd },
        },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: {
          organizationId,
          date: { gte: lastMonthStart, lte: lastMonthEnd },
        },
        _sum: { amount: true },
      }),
    ]);

    // Fetch outstanding invoices
    const outstandingInvoices = await prisma.invoice.findMany({
      where: {
        organizationId,
        status: { in: ["draft", "sent"] },
      },
      include: {
        customer: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
    });

    // Fetch top customers
    const topCustomers = await prisma.customer.findMany({
      where: { organizationId },
      include: {
        invoices: {
          where: {
            issueDate: { gte: thisMonthStart, lte: thisMonthEnd },
          },
          select: { total: true },
        },
      },
      take: 10,
    });

    const topCustomersByRevenue = topCustomers
      .map((customer) => ({
        ...customer,
        revenue: customer.invoices.reduce((sum, inv) => sum + inv.total, 0),
      }))
      .filter((c) => c.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Fetch expense categories
    const expensesByCategory = await prisma.expense.groupBy({
      by: ["categoryId"],
      where: {
        organizationId,
        date: { gte: thisMonthStart, lte: thisMonthEnd },
      },
      _sum: { amount: true },
    });

    const categories = await prisma.expenseCategory.findMany({
      where: {
        id: { in: expensesByCategory.map((e) => e.categoryId) },
      },
    });

    const expensesWithCategories = expensesByCategory
      .map((expense) => ({
        category: categories.find((c) => c.id === expense.categoryId)?.name || "Unknown",
        amount: expense._sum.amount || 0,
      }))
      .sort((a, b) => b.amount - a.amount);

    const pdfBytes = generateDashboardSummaryPDF({
      totalTrucks,
      activeTrucks,
      totalDrivers,
      activeDrivers,
      thisMonthTrips,
      lastMonthTrips,
      completedTrips,
      inProgressTrips,
      thisMonthInvoiceTotal: thisMonthInvoices._sum?.total || 0,
      lastMonthInvoiceTotal: lastMonthInvoices._sum?.total || 0,
      thisMonthPaymentTotal: thisMonthPayments._sum?.amount || 0,
      lastMonthPaymentTotal: lastMonthPayments._sum?.amount || 0,
      thisMonthExpenseTotal: thisMonthExpenses._sum?.amount || 0,
      lastMonthExpenseTotal: lastMonthExpenses._sum?.amount || 0,
      outstandingInvoices: outstandingInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        total: inv.total,
        dueDate: inv.dueDate,
        customer: { name: inv.customer.name },
      })),
      topCustomersByRevenue: topCustomersByRevenue.map((c) => ({
        name: c.name,
        revenue: c.revenue,
      })),
      expensesWithCategories,
    });

    return {
      success: true,
      pdf: Buffer.from(pdfBytes).toString("base64"),
      filename: `dashboard-summary-${new Date().toISOString().split("T")[0]}.pdf`,
    };
  } catch (error) {
    console.error("Failed to export dashboard PDF:", error);
    return { success: false, error: "Failed to generate dashboard PDF report" };
  }
}
