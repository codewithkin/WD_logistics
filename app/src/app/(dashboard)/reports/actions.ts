"use server";

import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { resolvePeriod, previousPeriod, type PeriodInput } from "@/lib/period-range";
import { z } from "zod";
import { unstable_rethrow } from "next/navigation";
import {
  fetchProfitPerUnitData,
  fetchRevenueData,
  fetchExpenseData,
  fetchCustomerStatementData,
  fetchTripSummaryData,
  fetchTruckProfitabilityData,
  fetchAccountLedgerData,
} from "@/lib/reports/data-fetchers";
import {
  generateProfitPerUnitCSV,
  generateRevenueCSV,
  generateExpenseCSV,
  generateCustomerStatementCSV,
  generateTripSummaryCSV,
  generateTruckProfitabilityCSV,
  generateAccountLedgerCSV,
} from "@/lib/reports/csv-generator";
import {
  generateProfitPerUnitPDF,
  generateRevenueReportPDF,
  generateExpenseReportPDF,
  generateTripSummaryPDF,
  generateCustomerStatementPDF,
  generateDashboardSummaryPDF,
  generateTruckProfitabilityPDF,
  generateAccountLedgerPDF,
} from "@/lib/reports/pdf-report-generator";

// Input validation schema
const generateReportSchema = z.object({
  reportType: z.enum([
    "customer-profitability",
    "expense-categories",
    "document-expiry",
    "inventory-valuation",
    "trip-pnl",
    "fuel-report",
    "maintenance-downtime",
    "driver-performance",
    "profit-loss",
    "aged-receivables",
    "creditors",
    "cash-flow",
    "truck-cost-breakdown",
    "profit-per-unit",
    "revenue",
    "expenses",
    "customer-statement",
    "trip-summary",
    "truck-profitability",
    "account-ledger",
    "truck-expenses",
    "trailer-expenses",
    "trip-expenses",
  ]),
  startDate: z.string(),
  endDate: z.string(),
  period: z.string(),
  format: z.enum(["pdf", "csv"]),
  /**
   * Whether a CSV carries its title, period and generated-at above the data.
   * On by default because these files are opened in Excel by people far more
   * often than they are parsed by scripts; turn it off for a clean import.
   */
  includeMetadata: z.boolean().optional(),
  customerId: z.string().optional(),
  truckId: z.string().optional(),
  trailerId: z.string().optional(),
  tripId: z.string().optional(),
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
    const { reportType, startDate, endDate, period, format, customerId, truckId, trailerId, tripId } = validated;
    const includeMetadata = validated.includeMetadata ?? true;

    const start = new Date(startDate);
    const end = new Date(endDate);
    const periodObj = { startDate: start, endDate: end };

    let fileBuffer: Buffer | Uint8Array;
    let mimeType: string;
    let fileExtension: string;
    let filename: string;

    switch (reportType) {
      // Item 1's "separate report": the same figures as the on-screen
      // breakdown, reading from lib/metrics/truck-costs so the two can never
      // disagree. One truck when truckId is given, the whole fleet otherwise.
      // ---- Commercial and operational. Customer profitability and trip
      // P&L are contribution figures: they carry the costs booked against
      // the trip, not a share of standing truck costs or overheads, and
      // each document says so on its face.
      case "customer-profitability": {
        const { fetchCustomerProfitabilityData } = await import("@/lib/reports/operations-fetchers");
        const { generateCustomerProfitabilityPDF } = await import("@/lib/documents/operations-reports");
        const { generateCustomerProfitabilityCSV } = await import("@/lib/reports/operations-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchCustomerProfitabilityData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateCustomerProfitabilityPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateCustomerProfitabilityCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `customer-profitability-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      case "expense-categories": {
        const { fetchExpenseCategoryReportData } = await import("@/lib/reports/operations-fetchers");
        const { generateExpenseCategoryReportPDF } = await import("@/lib/documents/operations-reports");
        const { generateExpenseCategoryReportCSV } = await import("@/lib/reports/operations-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchExpenseCategoryReportData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateExpenseCategoryReportPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateExpenseCategoryReportCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `expense-categories-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      case "document-expiry": {
        const { fetchDocumentExpiryReportData } = await import("@/lib/reports/operations-fetchers");
        const { generateDocumentExpiryReportPDF } = await import("@/lib/documents/operations-reports");
        const { generateDocumentExpiryReportCSV } = await import("@/lib/reports/operations-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchDocumentExpiryReportData(organizationId, end, 90);

        if (format === "pdf") {
          fileBuffer = generateDocumentExpiryReportPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateDocumentExpiryReportCSV(data, {
              company: organization?.name,
              period: `As at ${endDate}, next 90 days`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `document-expiry-${endDate}.${fileExtension}`;
        break;
      }

      case "inventory-valuation": {
        const { fetchInventoryValuationData } = await import("@/lib/reports/operations-fetchers");
        const { generateInventoryValuationPDF } = await import("@/lib/documents/operations-reports");
        const { generateInventoryValuationCSV } = await import("@/lib/reports/operations-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchInventoryValuationData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateInventoryValuationPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateInventoryValuationCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `inventory-valuation-${endDate}.${fileExtension}`;
        break;
      }

      case "trip-pnl": {
        const { fetchTripPnLData } = await import("@/lib/reports/operations-fetchers");
        const { generateTripPnLPDF } = await import("@/lib/documents/operations-reports");
        const { generateTripPnLCSV } = await import("@/lib/reports/operations-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchTripPnLData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateTripPnLPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateTripPnLCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `trip-pnl-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      // ---- Fleet. Fuel and downtime reuse the definitions in
      // lib/metrics/truck-costs (category `kind` for fuel, raised-until-fixed
      // for downtime) so a report and a truck's own page cannot disagree.
      case "fuel-report": {
        const { fetchFuelReportData } = await import("@/lib/reports/fleet-fetchers");
        const { generateFuelReportPDF } = await import(
          "@/lib/documents/fleet-reports"
        );
        const { generateFuelReportCSV } = await import("@/lib/reports/fleet-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchFuelReportData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateFuelReportPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateFuelReportCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `fuel-report-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      case "maintenance-downtime": {
        const { fetchMaintenanceReportData } = await import(
          "@/lib/reports/fleet-fetchers"
        );
        const { generateMaintenanceReportPDF } = await import(
          "@/lib/documents/fleet-reports"
        );
        const { generateMaintenanceReportCSV } = await import(
          "@/lib/reports/fleet-csv"
        );

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchMaintenanceReportData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateMaintenanceReportPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateMaintenanceReportCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `maintenance-downtime-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      case "driver-performance": {
        const { fetchDriverPerformanceReportData } = await import(
          "@/lib/reports/fleet-fetchers"
        );
        const { generateDriverPerformanceReportPDF } = await import(
          "@/lib/documents/fleet-reports"
        );
        const { generateDriverPerformanceReportCSV } = await import(
          "@/lib/reports/fleet-csv"
        );

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchDriverPerformanceReportData(
          organizationId,
          start,
          end,
        );

        if (format === "pdf") {
          fileBuffer = generateDriverPerformanceReportPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateDriverPerformanceReportCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `driver-performance-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      // ---- The four money reports. Each reads figures computed once in
      // lib/reports/finance-fetchers, so the PDF, the CSV and the screen can
      // never disagree about what the business earned or owes.
      case "profit-loss": {
        const { fetchProfitAndLossData } = await import(
          "@/lib/reports/finance-fetchers"
        );
        const { generateProfitAndLossPDF } = await import(
          "@/lib/documents/finance-reports"
        );
        const { generateProfitAndLossCSV } = await import(
          "@/lib/reports/finance-csv"
        );

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchProfitAndLossData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateProfitAndLossPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateProfitAndLossCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `profit-loss-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      case "aged-receivables": {
        const { fetchAgedReceivablesData } = await import(
          "@/lib/reports/finance-fetchers"
        );
        const { generateAgedReceivablesPDF } = await import(
          "@/lib/documents/finance-reports"
        );
        const { generateAgedReceivablesCSV } = await import(
          "@/lib/reports/finance-csv"
        );

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        // Ageing is a position, not a flow: it is always "as at" a date, and
        // the end of the chosen period is the date the reader means.
        const data = await fetchAgedReceivablesData(organizationId, end);

        if (format === "pdf") {
          fileBuffer = generateAgedReceivablesPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateAgedReceivablesCSV(data, {
              company: organization?.name,
              period: `As at ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `aged-receivables-${endDate}.${fileExtension}`;
        break;
      }

      case "creditors": {
        const { fetchCreditorsData } = await import(
          "@/lib/reports/finance-fetchers"
        );
        const { generateCreditorsPDF } = await import(
          "@/lib/documents/finance-reports"
        );
        const { generateCreditorsCSV } = await import("@/lib/reports/finance-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchCreditorsData(organizationId, end);

        if (format === "pdf") {
          fileBuffer = generateCreditorsPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateCreditorsCSV(data, {
              company: organization?.name,
              period: `As at ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `creditors-${endDate}.${fileExtension}`;
        break;
      }

      case "cash-flow": {
        const { fetchCashFlowData } = await import(
          "@/lib/reports/finance-fetchers"
        );
        const { generateCashFlowPDF } = await import(
          "@/lib/documents/finance-reports"
        );
        const { generateCashFlowCSV } = await import("@/lib/reports/finance-csv");

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const data = await fetchCashFlowData(organizationId, start, end);

        if (format === "pdf") {
          fileBuffer = generateCashFlowPDF({ organization, data });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          fileBuffer = Buffer.from(
            generateCashFlowCSV(data, {
              company: organization?.name,
              period: `${startDate} to ${endDate}`,
              includeMetadata,
            }),
            "utf-8",
          );
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `cash-flow-${startDate}-to-${endDate}.${fileExtension}`;
        break;
      }

      case "truck-cost-breakdown": {
        const { generateTruckCostReportPDF } = await import(
          "@/lib/documents/truck-cost-report"
        );
        const { getTruckCostBreakdown, getFleetCostRanking } = await import(
          "@/lib/metrics/truck-costs"
        );
        const { generateTruckCostBreakdownCSV } = await import(
          "@/lib/reports/csv-generator"
        );

        const organization = await prisma.organization.findUnique({
          where: { id: organizationId },
        });
        const range = { from: start, to: end };

        if (truckId) {
          const truck = await prisma.truck.findFirst({
            where: { id: truckId, organizationId },
          });
          if (!truck) {
            return { success: false, error: "Truck not found" };
          }
          const breakdown = await getTruckCostBreakdown(
            organizationId,
            truckId,
            range,
          );

          if (format === "pdf") {
            fileBuffer = generateTruckCostReportPDF({
              organization,
              period: range,
              truck: {
                registrationNo: truck.registrationNo,
                make: truck.make,
                model: truck.model,
                year: truck.year,
                breakdown,
              },
            });
            mimeType = "application/pdf";
            fileExtension = "pdf";
          } else {
            // A single truck's CSV is its category split, which is what a
            // spreadsheet reader actually wants to pivot on.
            const csv = [
              `"WD Logistics - Cost Breakdown ${truck.registrationNo}"`,
              `"Period: ${start.toISOString().split("T")[0]} - ${end.toISOString().split("T")[0]}"`,
              `""`,
              `Category,Type,Count,Amount,Share %,Fleet share %`,
              ...breakdown.byCategory.map(
                (c) =>
                  `"${c.category}","${c.kindLabel}",${c.count},${c.amount},${c.share},${c.fleetShare}`,
              ),
            ].join("\n");
            fileBuffer = Buffer.from(csv, "utf-8");
            mimeType = "text/csv";
            fileExtension = "csv";
          }
          filename = `truck-cost-${truck.registrationNo.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${start.toISOString().split("T")[0]}.${fileExtension}`;
          break;
        }

        const fleet = await getFleetCostRanking(organizationId, range);
        if (format === "pdf") {
          fileBuffer = generateTruckCostReportPDF({
            organization,
            period: range,
            fleet,
          });
          mimeType = "application/pdf";
          fileExtension = "pdf";
        } else {
          const csv = generateTruckCostBreakdownCSV(
            fleet.map((row) => ({
              registrationNo: row.registrationNo,
              revenue: row.revenue,
              expenses: row.expenses,
              profit: row.profit,
              margin: row.margin,
              kilometres: row.kilometres,
              costPerKm: row.costPerKm,
              worstCategory: row.worstCategory
                ? `${row.worstCategory.name} (${row.worstCategory.share}% vs fleet ${row.worstCategory.fleetShare}%)`
                : "",
            })),
            {
              startDate: start.toISOString().split("T")[0],
              endDate: end.toISOString().split("T")[0],
              period,
              generatedAt: new Date(),
            },
          );
          fileBuffer = Buffer.from(csv, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `fleet-cost-breakdown-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      case "profit-per-unit": {
        const data = await fetchProfitPerUnitData(organizationId, start, end);

        if (format === "pdf") {
          // The generator takes `units` with a `unitNumber`, plus totals it
          // does not compute itself. This passed `trucks` instead, so the PDF
          // died on `data.units.length` every single time it was generated —
          // a crash that shipped because next.config.ts ignores type errors.
          const totals = data.reduce(
            (acc, row) => ({
              trips: acc.trips + row.trips,
              revenue: acc.revenue + row.revenue,
              expenses: acc.expenses + row.expenses,
              profit: acc.profit + row.profit,
              profitMargin: 0,
            }),
            { trips: 0, revenue: 0, expenses: 0, profit: 0, profitMargin: 0 },
          );
          totals.profitMargin =
            totals.revenue > 0
              ? Math.round((totals.profit / totals.revenue) * 10000) / 100
              : 0;

          const pdfBytes = generateProfitPerUnitPDF({
            units: data.map((row) => ({
              unitNumber: `${row.registrationNo} (${row.make} ${row.model})`,
              trips: row.trips,
              revenue: row.revenue,
              expenses: row.expenses,
              profit: row.profit,
              profitMargin: row.profitMargin,
            })),
            totals,
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
          // The fetcher calls it `invoiceNo` and carries the trip; the
          // generator wants `invoiceNumber` and a `description`. Passing the
          // rows straight through left the Invoice # column blank on every
          // revenue PDF ever produced, and dropped the trip entirely.
          const pdfBytes = generateRevenueReportPDF({
            items: data.map((row) => ({
              date: row.date,
              customer: row.customer,
              invoiceNumber: row.invoiceNo,
              description: row.trip,
              amount: row.amount,
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

      case "truck-profitability": {
        if (!truckId) {
          return { success: false, error: "Truck is required for truck profitability report" };
        }

        const profitabilityData = await fetchTruckProfitabilityData(
          organizationId,
          truckId,
          start,
          end
        );

        if (format === "pdf") {
          const pdfBytes = generateTruckProfitabilityPDF({
            ...profitabilityData,
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
          const csvContent = generateTruckProfitabilityCSV(profitabilityData, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `truck-profitability-${profitabilityData.truck.registrationNo.replace(/\s+/g, "-")}-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      case "account-ledger": {
        const ledgerData = await fetchAccountLedgerData(organizationId, start, end);

        if (format === "pdf") {
          const pdfBytes = generateAccountLedgerPDF({
            accounts: ledgerData,
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
          const csvContent = generateAccountLedgerCSV(ledgerData, meta);
          fileBuffer = Buffer.from(csvContent, "utf-8");
          mimeType = "text/csv";
          fileExtension = "csv";
        }
        filename = `account-ledger-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
        break;
      }

      // Expenses-only variants. They share one implementation because the
      // only thing that differs is which entity the expenses hang off; the
      // combined revenue-vs-expenses reports live in their own cases above.
      case "truck-expenses":
      case "trailer-expenses":
      case "trip-expenses": {
        const scope =
          reportType === "truck-expenses"
            ? { truckId }
            : reportType === "trailer-expenses"
              ? { trailerId }
              : { tripId };

        const scopeId = scope.truckId ?? scope.trailerId ?? scope.tripId;
        if (!scopeId) {
          const what =
            reportType === "truck-expenses"
              ? "truck"
              : reportType === "trailer-expenses"
                ? "trailer"
                : "trip";
          return { success: false, error: `Please choose a ${what} for this report.` };
        }

        const data = await fetchExpenseData(organizationId, start, end, scope);

        // A period with no rows produces a report that says so, rather than
        // an error. Refusing made "nothing was spent on this trailer"
        // indistinguishable from "the export broke", and the document kit
        // already prints a stated empty line in place of a bare table.

        if (format === "pdf") {
          const pdfBytes = generateExpenseReportPDF({
            expenses: data.map((e) => ({
              date: e.date,
              category: e.category,
              description: e.description,
              amount: e.amount,
            })),
            byCategory: Object.values(
              data.reduce<Record<string, { category: string; amount: number; count: number }>>(
                (acc, e) => {
                  const bucket = (acc[e.category] ??= { category: e.category, amount: 0, count: 0 });
                  bucket.amount += e.amount;
                  bucket.count += 1;
                  return acc;
                },
                {}
              )
            ).sort((a, b) => b.amount - a.amount),
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
        filename = `${reportType}-${start.toISOString().split("T")[0]}-to-${end.toISOString().split("T")[0]}.${fileExtension}`;
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
    // requireRole() redirects rather than throwing a normal error, and Next
    // signals that by throwing. Swallowing it turned a non-admin's blocked
    // request into a toast reading "NEXT_REDIRECT"; unstable_rethrow lets
    // the framework's own control-flow errors through untouched.
    unstable_rethrow(error);

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

/**
 * Get trucks for the dropdown in truck performance report
 */

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
export async function exportDashboardPDF(period?: PeriodInput) {
  const session = await requireRole(["admin"]);
  const { organizationId } = session;

  try {
    // The export used to compare this calendar month against last, whatever
    // period the page was showing. It now follows the selector, and compares
    // against the window of the same length immediately before it.
    const range = resolvePeriod(period, "1m");
    const prior = previousPeriod(range);
    const thisMonthStart = range.from;
    const thisMonthEnd = range.to;
    const lastMonthStart = prior.from;
    const lastMonthEnd = prior.to;

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
      period: { startDate: range.from, endDate: range.to },
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
