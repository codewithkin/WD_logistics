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
