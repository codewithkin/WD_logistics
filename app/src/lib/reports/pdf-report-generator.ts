/**
 * Professional PDF Report Generator using jsPDF
 * 
 * This module provides a unified template for generating accounting-style
 * PDF reports with proper formatting, tables, and financial language.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: typeof autoTable;
    lastAutoTable: {
      finalY: number;
    };
  }
}

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface ReportColumn {
  header: string;
  key: string;
  width?: number;
  align?: "left" | "center" | "right";
  format?: "currency" | "percentage" | "number" | "date" | "text";
}

export interface ReportSection {
  title: string;
  columns: ReportColumn[];
  data: Record<string, unknown>[];
  showTotal?: boolean;
  totalLabel?: string;
  totalColumns?: string[]; // Keys of columns to sum
}

export interface SummaryItem {
  label: string;
  value: string | number;
  format?: "currency" | "percentage" | "number" | "text";
  highlight?: boolean;
  positive?: boolean;
  negative?: boolean;
}

export interface ReportConfig {
  title: string;
  subtitle?: string;
  reportType: string;
  period: {
    startDate: Date | string;
    endDate: Date | string;
  };
  summary?: SummaryItem[];
  sections: ReportSection[];
  notes?: string[];
  footer?: string;
  companyName?: string;
  companyInfo?: {
    address?: string;
    phone?: string;
    email?: string;
  };
}

// ============================================================================
// CONSTANTS
// ============================================================================

const COLORS = {
  primary: "#1e40af",        // Blue
  primaryLight: "#3b82f6",   // Light blue
  secondary: "#64748b",      // Gray
  success: "#10b981",        // Green
  danger: "#ef4444",         // Red
  warning: "#f59e0b",        // Amber
  dark: "#1f2937",           // Dark gray
  light: "#f3f4f6",          // Light gray
  white: "#ffffff",
  black: "#000000",
};

const FONTS = {
  normal: "helvetica",
  bold: "helvetica",
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function formatCurrency(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatNumber(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
}

function formatPercentage(value: number | string): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "-";
  return `${num.toFixed(1)}%`;
}

function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(d);
}

function formatValue(value: unknown, format?: string): string {
  if (value === null || value === undefined) return "-";
  
  switch (format) {
    case "currency":
      return formatCurrency(value as number);
    case "percentage":
      return formatPercentage(value as number);
    case "number":
      return formatNumber(value as number);
    case "date":
      return formatDate(value as Date | string);
    default:
      return String(value);
  }
}

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)]
    : [0, 0, 0];
}

// ============================================================================
// PDF GENERATOR CLASS
// ============================================================================

export class PDFReportGenerator {
  private doc: jsPDF;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number;
  private contentWidth: number;
  private currentY: number;
  private config: ReportConfig;

  constructor(config: ReportConfig) {
    this.config = {
      companyName: "WD Logistics",
      companyInfo: {
        address: "Harare, Zimbabwe",
        phone: "+263 XX XXX XXXX",
        email: "info@wdlogistics.co.zw",
      },
      ...config,
    };
    
    this.doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 15;
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this.currentY = this.margin;
  }

  // --------------------------------------------------------------------------
  // HEADER SECTION
  // --------------------------------------------------------------------------

  private renderHeader(): void {
    const { companyName, companyInfo, title, subtitle, period, reportType } = this.config;

    // Company Name
    this.doc.setFontSize(22);
    this.doc.setFont(FONTS.bold, "bold");
    this.doc.setTextColor(...hexToRgb(COLORS.primary));
    this.doc.text(companyName!, this.margin, this.currentY + 8);

    // Company Info (right aligned)
    this.doc.setFontSize(8);
    this.doc.setFont(FONTS.normal, "normal");
    this.doc.setTextColor(...hexToRgb(COLORS.secondary));
    
    const rightX = this.pageWidth - this.margin;
    if (companyInfo?.address) {
      this.doc.text(companyInfo.address, rightX, this.currentY + 4, { align: "right" });
    }
    if (companyInfo?.phone) {
      this.doc.text(companyInfo.phone, rightX, this.currentY + 8, { align: "right" });
    }
    if (companyInfo?.email) {
      this.doc.text(companyInfo.email, rightX, this.currentY + 12, { align: "right" });
    }

    this.currentY += 18;

    // Divider line
    this.doc.setDrawColor(...hexToRgb(COLORS.primary));
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 8;

    // Report Title
    this.doc.setFontSize(16);
    this.doc.setFont(FONTS.bold, "bold");
    this.doc.setTextColor(...hexToRgb(COLORS.dark));
    this.doc.text(title.toUpperCase(), this.pageWidth / 2, this.currentY, { align: "center" });
    this.currentY += 6;

    // Subtitle
    if (subtitle) {
      this.doc.setFontSize(10);
      this.doc.setFont(FONTS.normal, "normal");
      this.doc.setTextColor(...hexToRgb(COLORS.secondary));
      this.doc.text(subtitle, this.pageWidth / 2, this.currentY, { align: "center" });
      this.currentY += 5;
    }

    // Period
    const periodStr = `Reporting Period: ${formatDate(period.startDate)} to ${formatDate(period.endDate)}`;
    this.doc.setFontSize(9);
    this.doc.setTextColor(...hexToRgb(COLORS.secondary));
    this.doc.text(periodStr, this.pageWidth / 2, this.currentY, { align: "center" });
    this.currentY += 4;

    // Generated date
    const generatedStr = `Generated: ${formatDate(new Date())} at ${new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`;
    this.doc.setFontSize(8);
    this.doc.text(generatedStr, this.pageWidth / 2, this.currentY, { align: "center" });
    this.currentY += 10;
  }

  // --------------------------------------------------------------------------
  // SUMMARY SECTION
  // --------------------------------------------------------------------------

  private renderSummary(): void {
    if (!this.config.summary || this.config.summary.length === 0) return;

    // Executive Summary Title
    this.doc.setFontSize(11);
    this.doc.setFont(FONTS.bold, "bold");
    this.doc.setTextColor(...hexToRgb(COLORS.primary));
    this.doc.text("EXECUTIVE SUMMARY", this.margin, this.currentY);
    this.currentY += 6;

    // Summary boxes
    const boxWidth = (this.contentWidth - 6) / Math.min(this.config.summary.length, 4);
    const boxHeight = 18;
    let currentX = this.margin;
    let rowCount = 0;

    this.config.summary.forEach((item, index) => {
      if (index > 0 && index % 4 === 0) {
        // Move to next row
        this.currentY += boxHeight + 4;
        currentX = this.margin;
        rowCount++;
      }

      // Box background
      this.doc.setFillColor(...hexToRgb(COLORS.light));
      this.doc.roundedRect(currentX, this.currentY, boxWidth - 2, boxHeight, 2, 2, "F");

      // Label
      this.doc.setFontSize(7);
      this.doc.setFont(FONTS.normal, "normal");
      this.doc.setTextColor(...hexToRgb(COLORS.secondary));
      this.doc.text(item.label.toUpperCase(), currentX + 3, this.currentY + 5);

      // Value
      this.doc.setFontSize(12);
      this.doc.setFont(FONTS.bold, "bold");
      
      if (item.positive) {
        this.doc.setTextColor(...hexToRgb(COLORS.success));
      } else if (item.negative) {
        this.doc.setTextColor(...hexToRgb(COLORS.danger));
      } else if (item.highlight) {
        this.doc.setTextColor(...hexToRgb(COLORS.primary));
      } else {
        this.doc.setTextColor(...hexToRgb(COLORS.dark));
      }
      
      const formattedValue = formatValue(item.value, item.format);
      this.doc.text(formattedValue, currentX + 3, this.currentY + 13);

      currentX += boxWidth;
    });

    this.currentY += boxHeight + 10;
  }

  // --------------------------------------------------------------------------
  // TABLE SECTIONS
  // --------------------------------------------------------------------------

  private renderSections(): void {
    this.config.sections.forEach((section, sectionIndex) => {
      // Check if we need a new page
      if (this.currentY > this.pageHeight - 60) {
        this.doc.addPage();
        this.currentY = this.margin;
      }

      // Section Title
      this.doc.setFontSize(11);
      this.doc.setFont(FONTS.bold, "bold");
      this.doc.setTextColor(...hexToRgb(COLORS.primary));
      this.doc.text(section.title.toUpperCase(), this.margin, this.currentY);
      this.currentY += 6;

      // Prepare table data
      const headers = section.columns.map((col) => col.header);
      const body = section.data.map((row) =>
        section.columns.map((col) => formatValue(row[col.key], col.format))
      );

      // Calculate totals if needed
      if (section.showTotal && section.totalColumns) {
        const totals = section.columns.map((col) => {
          if (section.totalColumns?.includes(col.key)) {
            const sum = section.data.reduce((acc, row) => {
              const val = row[col.key];
              return acc + (typeof val === "number" ? val : 0);
            }, 0);
            return formatValue(sum, col.format);
          }
          return "";
        });
        totals[0] = section.totalLabel || "TOTAL";
        body.push(totals);
      }

      // Column styles
      const columnStyles: Record<number, { halign: "left" | "center" | "right" }> = {};
      section.columns.forEach((col, index) => {
        if (col.align) {
          columnStyles[index] = { halign: col.align };
        } else if (col.format === "currency" || col.format === "number" || col.format === "percentage") {
          columnStyles[index] = { halign: "right" };
        }
      });

      // Render table
      autoTable(this.doc, {
        startY: this.currentY,
        head: [headers],
        body: body,
        theme: "plain",
        styles: {
          fontSize: 8,
          cellPadding: 3,
          lineColor: hexToRgb(COLORS.light),
          lineWidth: 0.1,
        },
        headStyles: {
          fillColor: hexToRgb(COLORS.primary),
          textColor: hexToRgb(COLORS.white),
          fontStyle: "bold",
          fontSize: 8,
        },
        alternateRowStyles: {
          fillColor: hexToRgb(COLORS.light),
        },
        columnStyles,
        didDrawPage: (data) => {
          // Add footer to each page
          this.renderPageFooter(data.pageNumber);
        },
        willDrawCell: (data) => {
          // Style the totals row differently
          if (section.showTotal && data.row.index === body.length - 1 && data.section === "body") {
            data.cell.styles.fillColor = hexToRgb(COLORS.primary);
            data.cell.styles.textColor = hexToRgb(COLORS.white);
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    });
  }

  // --------------------------------------------------------------------------
  // NOTES SECTION
  // --------------------------------------------------------------------------

  private renderNotes(): void {
    if (!this.config.notes || this.config.notes.length === 0) return;

    // Check if we need a new page
    if (this.currentY > this.pageHeight - 50) {
      this.doc.addPage();
      this.currentY = this.margin;
    }

    // Notes Title
    this.doc.setFontSize(10);
    this.doc.setFont(FONTS.bold, "bold");
    this.doc.setTextColor(...hexToRgb(COLORS.secondary));
    this.doc.text("Notes:", this.margin, this.currentY);
    this.currentY += 5;

    // Notes content
    this.doc.setFontSize(8);
    this.doc.setFont(FONTS.normal, "normal");
    this.doc.setTextColor(...hexToRgb(COLORS.secondary));

    this.config.notes.forEach((note, index) => {
      const lines = this.doc.splitTextToSize(`${index + 1}. ${note}`, this.contentWidth);
      this.doc.text(lines, this.margin, this.currentY);
      this.currentY += lines.length * 4 + 2;
    });
  }

  // --------------------------------------------------------------------------
  // FOOTER
  // --------------------------------------------------------------------------

  private renderPageFooter(pageNumber: number): void {
    const totalPages = (this.doc as any).internal.getNumberOfPages();
    const footerY = this.pageHeight - 10;

    // Divider line
    this.doc.setDrawColor(...hexToRgb(COLORS.light));
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, footerY - 3, this.pageWidth - this.margin, footerY - 3);

    // Footer text
    this.doc.setFontSize(7);
    this.doc.setFont(FONTS.normal, "normal");
    this.doc.setTextColor(...hexToRgb(COLORS.secondary));

    // Left: Company
    this.doc.text(`${this.config.companyName} © ${new Date().getFullYear()}`, this.margin, footerY);

    // Center: Confidential notice
    this.doc.text("CONFIDENTIAL - FOR INTERNAL USE ONLY", this.pageWidth / 2, footerY, { align: "center" });

    // Right: Page number
    this.doc.text(`Page ${pageNumber} of ${totalPages}`, this.pageWidth - this.margin, footerY, { align: "right" });
  }

  // --------------------------------------------------------------------------
  // MAIN GENERATE METHOD
  // --------------------------------------------------------------------------

  public generate(): Uint8Array {
    this.renderHeader();
    this.renderSummary();
    this.renderSections();
    this.renderNotes();

    // Render footer on all pages
    const totalPages = (this.doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      this.doc.setPage(i);
      this.renderPageFooter(i);
    }

    return this.doc.output("arraybuffer") as unknown as Uint8Array;
  }

  public generateBase64(): string {
    return this.doc.output("datauristring").split(",")[1];
  }

  public generateBlob(): Blob {
    return this.doc.output("blob");
  }
}

// ============================================================================
// HELPER FUNCTIONS FOR COMMON REPORT TYPES
// ============================================================================

/**
 * Generate an Expense Report PDF
 */
export function generateExpenseReportPDF(data: {
  expenses: Array<{
    date: Date | string;
    category: string;
    description?: string;
    amount: number;
    trucks?: string[];
    trips?: string[];
    drivers?: string[];
  }>;
  period: { startDate: Date | string; endDate: Date | string };
  summary?: {
    total: number;
    byCategory: Array<{ name: string; amount: number }>;
  };
}): Uint8Array {
  const totalAmount = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const expenseCount = data.expenses.length;

  // Group by category for summary
  const categoryTotals = data.expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount;
    return acc;
  }, {} as Record<string, number>);

  const topCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const config: ReportConfig = {
    title: "Expense Report",
    subtitle: "Detailed Operating Expenses Analysis",
    reportType: "expenses",
    period: data.period,
    summary: [
      { label: "Total Expenses", value: totalAmount, format: "currency", highlight: true },
      { label: "Number of Entries", value: expenseCount, format: "number" },
      { label: "Average per Entry", value: expenseCount > 0 ? totalAmount / expenseCount : 0, format: "currency" },
      ...(topCategories[0] ? [{ label: `Top: ${topCategories[0][0]}`, value: topCategories[0][1], format: "currency" as const }] : []),
    ],
    sections: [
      {
        title: "Expense Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Category", key: "category", align: "left" },
          { header: "Description", key: "description", align: "left" },
          { header: "Associated With", key: "associations", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.expenses.map((e) => ({
          date: e.date,
          category: e.category,
          description: e.description || "-",
          associations: [
            ...(e.trucks || []).map((t) => `🚛 ${t}`),
            ...(e.trips || []).map((t) => `📍 ${t}`),
            ...(e.drivers || []).map((d) => `👤 ${d}`),
          ].join(", ") || "-",
          amount: e.amount,
        })),
        showTotal: true,
        totalLabel: "TOTAL EXPENSES",
        totalColumns: ["amount"],
      },
      {
        title: "Expense Breakdown by Category",
        columns: [
          { header: "Category", key: "name", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
          { header: "% of Total", key: "percentage", format: "percentage", align: "right" },
        ],
        data: Object.entries(categoryTotals)
          .sort(([, a], [, b]) => b - a)
          .map(([name, amount]) => ({
            name,
            amount,
            percentage: totalAmount > 0 ? (amount / totalAmount) * 100 : 0,
          })),
        showTotal: true,
        totalLabel: "GRAND TOTAL",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are displayed in United States Dollars (USD).",
      "This report includes all recorded expenses for the specified period.",
      "Expense allocations may be distributed across multiple trucks, trips, or drivers.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Revenue Report PDF
 */
export function generateRevenueReportPDF(data: {
  items: Array<{
    date: Date | string;
    customer: string;
    invoiceNo?: string;
    trip?: string;
    amount: number;
  }>;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const totalRevenue = data.items.reduce((sum, i) => sum + i.amount, 0);
  const invoiceCount = data.items.length;

  // Group by customer
  const customerTotals = data.items.reduce((acc, i) => {
    acc[i.customer] = (acc[i.customer] || 0) + i.amount;
    return acc;
  }, {} as Record<string, number>);

  const topCustomers = Object.entries(customerTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  const config: ReportConfig = {
    title: "Revenue Report",
    subtitle: "Income Analysis and Customer Revenue Summary",
    reportType: "revenue",
    period: data.period,
    summary: [
      { label: "Total Revenue", value: totalRevenue, format: "currency", highlight: true, positive: true },
      { label: "Number of Transactions", value: invoiceCount, format: "number" },
      { label: "Average per Transaction", value: invoiceCount > 0 ? totalRevenue / invoiceCount : 0, format: "currency" },
      ...(topCustomers[0] ? [{ label: `Top Customer`, value: topCustomers[0][1], format: "currency" as const }] : []),
    ],
    sections: [
      {
        title: "Revenue Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Customer", key: "customer", align: "left" },
          { header: "Invoice #", key: "invoiceNo", align: "left" },
          { header: "Trip", key: "trip", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.items.map((i) => ({
          date: i.date,
          customer: i.customer,
          invoiceNo: i.invoiceNo || "-",
          trip: i.trip || "-",
          amount: i.amount,
        })),
        showTotal: true,
        totalLabel: "TOTAL REVENUE",
        totalColumns: ["amount"],
      },
      {
        title: "Revenue by Customer",
        columns: [
          { header: "Customer", key: "name", align: "left" },
          { header: "Revenue", key: "amount", format: "currency", align: "right" },
          { header: "% of Total", key: "percentage", format: "percentage", align: "right" },
        ],
        data: Object.entries(customerTotals)
          .sort(([, a], [, b]) => b - a)
          .map(([name, amount]) => ({
            name,
            amount,
            percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
          })),
        showTotal: true,
        totalLabel: "TOTAL",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are displayed in United States Dollars (USD).",
      "Revenue figures are based on invoiced amounts for the reporting period.",
      "This report does not account for outstanding receivables or payment status.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Profit Per Unit Report PDF
 */
export function generateProfitPerUnitPDF(data: {
  trucks: Array<{
    registrationNo: string;
    make: string;
    model: string;
    trips: number;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }>;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const totals = data.trucks.reduce(
    (acc, t) => ({
      trips: acc.trips + t.trips,
      revenue: acc.revenue + t.revenue,
      expenses: acc.expenses + t.expenses,
      profit: acc.profit + t.profit,
    }),
    { trips: 0, revenue: 0, expenses: 0, profit: 0 }
  );

  const overallMargin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const avgProfitPerTrip = totals.trips > 0 ? totals.profit / totals.trips : 0;

  const config: ReportConfig = {
    title: "Profit Per Unit Report",
    subtitle: "Fleet Profitability Analysis by Vehicle",
    reportType: "profit-per-unit",
    period: data.period,
    summary: [
      { label: "Total Revenue", value: totals.revenue, format: "currency", positive: true },
      { label: "Total Expenses", value: totals.expenses, format: "currency", negative: true },
      { label: "Net Profit", value: totals.profit, format: "currency", highlight: true, positive: totals.profit >= 0, negative: totals.profit < 0 },
      { label: "Overall Margin", value: overallMargin, format: "percentage" },
    ],
    sections: [
      {
        title: "Profitability by Truck",
        columns: [
          { header: "Truck", key: "registrationNo", align: "left" },
          { header: "Make/Model", key: "vehicle", align: "left" },
          { header: "Trips", key: "trips", format: "number", align: "right" },
          { header: "Revenue", key: "revenue", format: "currency", align: "right" },
          { header: "Expenses", key: "expenses", format: "currency", align: "right" },
          { header: "Profit", key: "profit", format: "currency", align: "right" },
          { header: "Margin", key: "profitMargin", format: "percentage", align: "right" },
        ],
        data: data.trucks.map((t) => ({
          registrationNo: t.registrationNo,
          vehicle: `${t.make} ${t.model}`,
          trips: t.trips,
          revenue: t.revenue,
          expenses: t.expenses,
          profit: t.profit,
          profitMargin: t.profitMargin,
        })),
        showTotal: true,
        totalLabel: "FLEET TOTAL",
        totalColumns: ["trips", "revenue", "expenses", "profit"],
      },
    ],
    notes: [
      "All amounts are displayed in United States Dollars (USD).",
      "Profit margin is calculated as (Profit / Revenue) × 100.",
      `Average profit per trip across the fleet: ${formatCurrency(avgProfitPerTrip)}.`,
      "Trucks with negative margins should be reviewed for operational efficiency.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Trip Summary Report PDF
 */
export function generateTripSummaryPDF(data: {
  trips: Array<{
    tripNumber?: string;
    date: Date | string;
    origin: string;
    destination: string;
    truck: string;
    driver: string;
    customer?: string;
    revenue: number;
    expenses: number;
    profit: number;
    status?: string;
  }>;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const totals = data.trips.reduce(
    (acc, t) => ({
      revenue: acc.revenue + t.revenue,
      expenses: acc.expenses + t.expenses,
      profit: acc.profit + t.profit,
    }),
    { revenue: 0, expenses: 0, profit: 0 }
  );

  const completedTrips = data.trips.filter((t) => t.status === "completed").length;

  const config: ReportConfig = {
    title: "Trip Summary Report",
    subtitle: "Operational Trip Analysis and Performance",
    reportType: "trip-summary",
    period: data.period,
    summary: [
      { label: "Total Trips", value: data.trips.length, format: "number" },
      { label: "Completed Trips", value: completedTrips, format: "number" },
      { label: "Total Revenue", value: totals.revenue, format: "currency", positive: true },
      { label: "Net Profit", value: totals.profit, format: "currency", highlight: true, positive: totals.profit >= 0, negative: totals.profit < 0 },
    ],
    sections: [
      {
        title: "Trip Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Route", key: "route", align: "left" },
          { header: "Truck", key: "truck", align: "left" },
          { header: "Driver", key: "driver", align: "left" },
          { header: "Revenue", key: "revenue", format: "currency", align: "right" },
          { header: "Profit", key: "profit", format: "currency", align: "right" },
        ],
        data: data.trips.map((t) => ({
          date: t.date,
          route: `${t.origin} → ${t.destination}`,
          truck: t.truck,
          driver: t.driver,
          revenue: t.revenue,
          profit: t.profit,
        })),
        showTotal: true,
        totalLabel: "TOTAL",
        totalColumns: ["revenue", "profit"],
      },
    ],
    notes: [
      "All amounts are displayed in United States Dollars (USD).",
      "Trip profit is calculated as Revenue minus directly allocated expenses.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Customer Statement PDF
 */
export function generateCustomerStatementPDF(data: {
  customer: {
    name: string;
    address?: string;
    email?: string;
    phone?: string;
  };
  entries: Array<{
    date: Date | string;
    type: string;
    reference: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  openingBalance: number;
  closingBalance: number;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const totalDebits = data.entries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredits = data.entries.reduce((sum, e) => sum + e.credit, 0);

  const config: ReportConfig = {
    title: "Customer Statement of Account",
    subtitle: `Account Statement for ${data.customer.name}`,
    reportType: "customer-statement",
    period: data.period,
    summary: [
      { label: "Opening Balance", value: data.openingBalance, format: "currency" },
      { label: "Total Debits", value: totalDebits, format: "currency", negative: true },
      { label: "Total Credits", value: totalCredits, format: "currency", positive: true },
      { label: "Closing Balance", value: data.closingBalance, format: "currency", highlight: true, negative: data.closingBalance > 0 },
    ],
    sections: [
      {
        title: "Account Activity",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Type", key: "type", align: "left" },
          { header: "Reference", key: "reference", align: "left" },
          { header: "Description", key: "description", align: "left" },
          { header: "Debit", key: "debit", format: "currency", align: "right" },
          { header: "Credit", key: "credit", format: "currency", align: "right" },
          { header: "Balance", key: "balance", format: "currency", align: "right" },
        ],
        data: data.entries.map((e) => ({
          date: e.date,
          type: e.type,
          reference: e.reference,
          description: e.description,
          debit: e.debit || 0,
          credit: e.credit || 0,
          balance: e.balance,
        })),
        showTotal: true,
        totalLabel: "TOTALS",
        totalColumns: ["debit", "credit"],
      },
    ],
    notes: [
      "All amounts are displayed in United States Dollars (USD).",
      "Debit entries represent invoices and charges to your account.",
      "Credit entries represent payments received.",
      data.closingBalance > 0
        ? `Payment of ${formatCurrency(data.closingBalance)} is due. Please remit at your earliest convenience.`
        : "Your account is current. Thank you for your business.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

export default PDFReportGenerator;
