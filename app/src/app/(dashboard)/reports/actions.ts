"use server";

import { renderToBuffer } from "@react-pdf/renderer";
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
  ProfitPerUnitReportPDF,
  RevenueReportPDF,
  ExpenseReportPDF,
  CustomerStatementPDF,
  TripSummaryReportPDF,
} from "@/lib/reports/pdf-generator";
import {
  generateFinancialReportProps,
  generateFinancialReportCSV,
} from "@/lib/reports/financial-data-fetchers";
import { FinancialReportTemplate } from "@/lib/reports/financial-report-template";
import React from "react";

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
    const meta = {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
      period,
      generatedAt: new Date(),
    };

    let fileBuffer: Buffer;
    let mimeType: string;
    let fileExtension: string;
    let filename: string;

    switch (reportType) {
      case "profit-per-unit": {
        const data = await fetchProfitPerUnitData(organizationId, start, end);

        if (format === "pdf") {
          const pdfDoc = React.createElement(ProfitPerUnitReportPDF, { data, meta });
          fileBuffer = await renderToBuffer(pdfDoc as any);
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const csvContent = generateProfitPerUnitCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `profit-per-unit-${meta.startDate}-to-${meta.endDate}.${fileExtension}`;
        break;
      }

      case "revenue": {
        if (format === "pdf") {
          const reportProps = await generateFinancialReportProps(
            "revenue",
            organizationId,
            start,
            end
          );
          const pdfDoc = React.createElement(FinancialReportTemplate, reportProps);
          fileBuffer = await renderToBuffer(pdfDoc as any);
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const csvContent = await generateFinancialReportCSV(
            "revenue",
            organizationId,
            start,
            end
          );
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `revenue-${meta.startDate}-to-${meta.endDate}.${fileExtension}`;
        break;
      }

      case "expenses": {
        const data = await fetchExpenseData(organizationId, start, end);

        if (format === "pdf") {
          const pdfDoc = React.createElement(ExpenseReportPDF, { data, meta });
          fileBuffer = await renderToBuffer(pdfDoc as any);
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const csvContent = generateExpenseCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `expenses-${meta.startDate}-to-${meta.endDate}.${fileExtension}`;
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

        const statementMeta = {
          ...meta,
          customerName: statementData.customer.name,
        };

        if (format === "pdf") {
          const pdfDoc = React.createElement(CustomerStatementPDF, {
            customer: statementData.customer,
            entries: statementData.entries,
            openingBalance: statementData.openingBalance,
            closingBalance: statementData.closingBalance,
            meta: statementMeta,
          });
          fileBuffer = await renderToBuffer(pdfDoc as any);
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const csvContent = generateCustomerStatementCSV(
            statementData.entries,
            statementMeta,
            statementData.openingBalance,
            statementData.closingBalance
          );
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `statement-${statementData.customer.name.replace(/\s+/g, "-")}-${meta.startDate}-to-${meta.endDate}.${fileExtension}`;
        break;
      }

      case "trip-summary": {
        const data = await fetchTripSummaryData(organizationId, start, end);

        if (format === "pdf") {
          const pdfDoc = React.createElement(TripSummaryReportPDF, { data, meta });
          fileBuffer = await renderToBuffer(pdfDoc as any);
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const csvContent = generateTripSummaryCSV(data, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `trip-summary-${meta.startDate}-to-${meta.endDate}.${fileExtension}`;
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
    const base64Data = fileBuffer.toString("base64");

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
