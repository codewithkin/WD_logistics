/**
 * Plain PDF Report Generator using jsPDF
 * 
 * Simple, clean formatting like a Word 2007 document.
 * Professional accounting style with basic tables and clear text.
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
  totalColumns?: string[];
}

export interface SummaryItem {
  label: string;
  value: string | number;
  format?: "currency" | "percentage" | "number" | "text";
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
  companyName?: string;
}

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
    month: "long",
    day: "numeric",
  }).format(d);
}

function formatShortDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
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
      return formatShortDate(value as Date | string);
    default:
      return String(value);
  }
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
  private pageNumber: number;

  constructor(config: ReportConfig) {
    this.config = {
      companyName: "WD Logistics",
      ...config,
    };
    
    this.doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    
    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();
    this.margin = 20;
    this.contentWidth = this.pageWidth - 2 * this.margin;
    this.currentY = this.margin;
    this.pageNumber = 1;
  }

  private renderHeader(): void {
    const { companyName, title, subtitle, period } = this.config;

    // Company Name - simple bold text
    this.doc.setFontSize(16);
    this.doc.setFont("times", "bold");
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(companyName!, this.margin, this.currentY);
    this.currentY += 8;

    // Simple underline
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 12;

    // Report Title - centered, bold
    this.doc.setFontSize(14);
    this.doc.setFont("times", "bold");
    this.doc.text(title.toUpperCase(), this.pageWidth / 2, this.currentY, { align: "center" });
    this.currentY += 7;

    // Subtitle if exists
    if (subtitle) {
      this.doc.setFontSize(11);
      this.doc.setFont("times", "normal");
      this.doc.text(subtitle, this.pageWidth / 2, this.currentY, { align: "center" });
      this.currentY += 6;
    }

    // Period
    this.doc.setFontSize(10);
    this.doc.setFont("times", "normal");
    const periodText = `For the period: ${formatDate(period.startDate)} to ${formatDate(period.endDate)}`;
    this.doc.text(periodText, this.pageWidth / 2, this.currentY, { align: "center" });
    this.currentY += 12;
  }

  private renderSummary(): void {
    if (!this.config.summary || this.config.summary.length === 0) return;

    // Summary Section Header
    this.doc.setFontSize(11);
    this.doc.setFont("times", "bold");
    this.doc.text("Summary", this.margin, this.currentY);
    this.currentY += 6;

    // Simple summary lines
    this.doc.setFontSize(10);
    this.doc.setFont("times", "normal");

    this.config.summary.forEach((item) => {
      const formattedValue = formatValue(item.value, item.format);
      const label = `${item.label}:`;
      
      this.doc.text(label, this.margin + 5, this.currentY);
      this.doc.text(formattedValue, this.margin + 70, this.currentY);
      this.currentY += 5;
    });

    this.currentY += 8;
  }

  private renderSections(): void {
    this.config.sections.forEach((section) => {
      // Check if we need a new page
      if (this.currentY > this.pageHeight - 50) {
        this.addNewPage();
      }

      // Section Title
      this.doc.setFontSize(11);
      this.doc.setFont("times", "bold");
      this.doc.text(section.title, this.margin, this.currentY);
      this.currentY += 6;

      // Prepare table data
      const headers = section.columns.map((col) => col.header);
      const body = section.data.map((row) =>
        section.columns.map((col) => formatValue(row[col.key], col.format))
      );

      // Add totals row if needed
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
        totals[0] = section.totalLabel || "Total";
        body.push(totals);
      }

      // Column alignment
      const columnStyles: Record<number, { halign: "left" | "center" | "right" }> = {};
      section.columns.forEach((col, index) => {
        if (col.align) {
          columnStyles[index] = { halign: col.align };
        } else if (col.format === "currency" || col.format === "number" || col.format === "percentage") {
          columnStyles[index] = { halign: "right" };
        }
      });

      // Render simple table with borders
      autoTable(this.doc, {
        startY: this.currentY,
        head: [headers],
        body: body,
        theme: "grid",
        styles: {
          fontSize: 9,
          font: "times",
          cellPadding: 2,
          lineColor: [0, 0, 0],
          lineWidth: 0.2,
          textColor: [0, 0, 0],
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineWidth: 0.2,
        },
        bodyStyles: {
          fillColor: [255, 255, 255],
        },
        columnStyles,
        margin: { left: this.margin, right: this.margin },
        didDrawPage: () => {
          this.renderPageFooter();
        },
        willDrawCell: (data) => {
          // Bold the totals row
          if (section.showTotal && data.row.index === body.length - 1 && data.section === "body") {
            data.cell.styles.fontStyle = "bold";
          }
        },
      });

      this.currentY = this.doc.lastAutoTable.finalY + 10;
    });
  }

  private renderNotes(): void {
    if (!this.config.notes || this.config.notes.length === 0) return;

    // Check if we need a new page
    if (this.currentY > this.pageHeight - 40) {
      this.addNewPage();
    }

    // Notes Header
    this.doc.setFontSize(11);
    this.doc.setFont("times", "bold");
    this.doc.text("Notes:", this.margin, this.currentY);
    this.currentY += 6;

    // Notes content
    this.doc.setFontSize(9);
    this.doc.setFont("times", "normal");

    this.config.notes.forEach((note, index) => {
      const noteText = `${index + 1}. ${note}`;
      const lines = this.doc.splitTextToSize(noteText, this.contentWidth - 10);
      
      lines.forEach((line: string) => {
        if (this.currentY > this.pageHeight - 25) {
          this.addNewPage();
        }
        this.doc.text(line, this.margin + 5, this.currentY);
        this.currentY += 4;
      });
      this.currentY += 2;
    });
  }

  private renderPageFooter(): void {
    const footerY = this.pageHeight - 10;
    
    // Simple footer line
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margin, footerY - 5, this.pageWidth - this.margin, footerY - 5);

    // Page number
    this.doc.setFontSize(9);
    this.doc.setFont("times", "normal");
    this.doc.text(
      `Page ${this.pageNumber}`,
      this.pageWidth / 2,
      footerY,
      { align: "center" }
    );

    // Date on right
    this.doc.text(
      formatShortDate(new Date()),
      this.pageWidth - this.margin,
      footerY,
      { align: "right" }
    );
  }

  private addNewPage(): void {
    this.doc.addPage();
    this.pageNumber++;
    this.currentY = this.margin;
  }

  private renderSignature(): void {
    if (this.currentY > this.pageHeight - 50) {
      this.addNewPage();
    }

    this.currentY += 15;

    // Prepared by section
    this.doc.setFontSize(10);
    this.doc.setFont("times", "normal");
    
    this.doc.text("Prepared by: _______________________", this.margin, this.currentY);
    this.doc.text("Date: _____________", this.margin + 100, this.currentY);
    this.currentY += 12;
    
    this.doc.text("Approved by: _______________________", this.margin, this.currentY);
    this.doc.text("Date: _____________", this.margin + 100, this.currentY);
  }

  public generate(): Uint8Array {
    this.renderHeader();
    this.renderSummary();
    this.renderSections();
    this.renderNotes();
    this.renderSignature();
    this.renderPageFooter();

    return this.doc.output("arraybuffer") as unknown as Uint8Array;
  }
}

// ============================================================================
// REPORT HELPER FUNCTIONS
// ============================================================================

/**
 * Generate an Expense Report PDF
 */
export function generateExpenseReportPDF(data: {
  expenses: Array<{
    date: Date | string;
    category: string;
    description: string;
    amount: number;
    reference?: string;
  }>;
  period: { startDate: Date | string; endDate: Date | string };
  byCategory?: Array<{
    category: string;
    amount: number;
    count: number;
  }>;
}): Uint8Array {
  const totalAmount = data.expenses.reduce((sum, e) => sum + e.amount, 0);

  const config: ReportConfig = {
    title: "Expense Report",
    subtitle: "Detailed Expense Analysis",
    reportType: "expenses",
    period: data.period,
    summary: [
      { label: "Total Expenses", value: totalAmount, format: "currency" },
      { label: "Number of Transactions", value: data.expenses.length, format: "number" },
      { label: "Average per Transaction", value: data.expenses.length > 0 ? totalAmount / data.expenses.length : 0, format: "currency" },
    ],
    sections: [
      {
        title: "Expense Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Category", key: "category", align: "left" },
          { header: "Description", key: "description", align: "left" },
          { header: "Reference", key: "reference", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.expenses.map((e) => ({
          date: e.date,
          category: e.category,
          description: e.description || "-",
          reference: e.reference || "-",
          amount: e.amount,
        })),
        showTotal: true,
        totalLabel: "Total",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "This report was generated from the WD Logistics system.",
    ],
  };

  // Add category breakdown if provided
  if (data.byCategory && data.byCategory.length > 0) {
    config.sections.push({
      title: "Expenses by Category",
      columns: [
        { header: "Category", key: "category", align: "left" },
        { header: "Number of Items", key: "count", format: "number", align: "center" },
        { header: "Total Amount", key: "amount", format: "currency", align: "right" },
      ],
      data: data.byCategory.map((c) => ({
        category: c.category,
        count: c.count,
        amount: c.amount,
      })),
      showTotal: true,
      totalLabel: "Grand Total",
      totalColumns: ["count", "amount"],
    });
  }

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
    invoiceNumber: string;
    description?: string;
    amount: number;
  }>;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const totalRevenue = data.items.reduce((sum, item) => sum + item.amount, 0);

  const config: ReportConfig = {
    title: "Revenue Report",
    subtitle: "Income and Sales Analysis",
    reportType: "revenue",
    period: data.period,
    summary: [
      { label: "Total Revenue", value: totalRevenue, format: "currency" },
      { label: "Number of Invoices", value: data.items.length, format: "number" },
      { label: "Average Invoice Value", value: data.items.length > 0 ? totalRevenue / data.items.length : 0, format: "currency" },
    ],
    sections: [
      {
        title: "Revenue Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Invoice No.", key: "invoiceNumber", align: "left" },
          { header: "Customer", key: "customer", align: "left" },
          { header: "Description", key: "description", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.items.map((item) => ({
          date: item.date,
          invoiceNumber: item.invoiceNumber,
          customer: item.customer,
          description: item.description || "-",
          amount: item.amount,
        })),
        showTotal: true,
        totalLabel: "Total Revenue",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Revenue figures represent invoiced amounts.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Profit Per Unit Report PDF
 */
export function generateProfitPerUnitPDF(data: {
  units: Array<{
    unitNumber: string;
    trips: number;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  }>;
  totals: {
    trips: number;
    revenue: number;
    expenses: number;
    profit: number;
    profitMargin: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Profit Per Unit Report",
    subtitle: "Fleet Profitability Analysis",
    reportType: "profit-per-unit",
    period: data.period,
    summary: [
      { label: "Total Units", value: data.units.length, format: "number" },
      { label: "Total Trips", value: data.totals.trips, format: "number" },
      { label: "Total Revenue", value: data.totals.revenue, format: "currency" },
      { label: "Total Expenses", value: data.totals.expenses, format: "currency" },
      { label: "Net Profit", value: data.totals.profit, format: "currency" },
      { label: "Overall Margin", value: data.totals.profitMargin, format: "percentage" },
    ],
    sections: [
      {
        title: "Unit Performance Details",
        columns: [
          { header: "Unit Number", key: "unitNumber", align: "left" },
          { header: "Trips", key: "trips", format: "number", align: "center" },
          { header: "Revenue", key: "revenue", format: "currency", align: "right" },
          { header: "Expenses", key: "expenses", format: "currency", align: "right" },
          { header: "Profit", key: "profit", format: "currency", align: "right" },
          { header: "Margin %", key: "profitMargin", format: "percentage", align: "right" },
        ],
        data: data.units.map((u) => ({
          unitNumber: u.unitNumber,
          trips: u.trips,
          revenue: u.revenue,
          expenses: u.expenses,
          profit: u.profit,
          profitMargin: u.profitMargin,
        })),
        showTotal: true,
        totalLabel: "Fleet Total",
        totalColumns: ["trips", "revenue", "expenses", "profit"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Profit is calculated as Revenue minus Expenses for each unit.",
      "Profit margin is calculated as (Profit / Revenue) x 100.",
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
    revenue: number;
    expenses: number;
    profit: number;
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

  const config: ReportConfig = {
    title: "Trip Summary Report",
    subtitle: "Operational Trip Analysis",
    reportType: "trip-summary",
    period: data.period,
    summary: [
      { label: "Total Trips", value: data.trips.length, format: "number" },
      { label: "Total Revenue", value: totals.revenue, format: "currency" },
      { label: "Total Expenses", value: totals.expenses, format: "currency" },
      { label: "Net Profit", value: totals.profit, format: "currency" },
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
          { header: "Expenses", key: "expenses", format: "currency", align: "right" },
          { header: "Profit", key: "profit", format: "currency", align: "right" },
        ],
        data: data.trips.map((t) => ({
          date: t.date,
          route: `${t.origin} - ${t.destination}`,
          truck: t.truck,
          driver: t.driver,
          revenue: t.revenue,
          expenses: t.expenses,
          profit: t.profit,
        })),
        showTotal: true,
        totalLabel: "Total",
        totalColumns: ["revenue", "expenses", "profit"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Trip profit is calculated as Revenue minus Expenses.",
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
    title: "Statement of Account",
    subtitle: `Customer: ${data.customer.name}`,
    reportType: "customer-statement",
    period: data.period,
    summary: [
      { label: "Opening Balance", value: data.openingBalance, format: "currency" },
      { label: "Total Debits", value: totalDebits, format: "currency" },
      { label: "Total Credits", value: totalCredits, format: "currency" },
      { label: "Closing Balance", value: data.closingBalance, format: "currency" },
    ],
    sections: [
      {
        title: "Transaction Details",
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
        totalLabel: "Totals",
        totalColumns: ["debit", "credit"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Please remit payment within 30 days of invoice date.",
      "For queries regarding this statement, please contact our accounts department.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Driver Report PDF
 */
export function generateDriverReportPDF(data: {
  drivers: Array<{
    name: string;
    phone: string;
    licenseNumber: string;
    status: string;
    assignedTruck: string;
    trips: number;
  }>;
  analytics: {
    totalDrivers: number;
    activeDrivers: number;
    driversWithTruck: number;
    totalTrips: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Driver Report",
    subtitle: "Fleet Driver Analysis",
    reportType: "driver-report",
    period: data.period,
    summary: [
      { label: "Total Drivers", value: data.analytics.totalDrivers, format: "number" },
      { label: "Active Drivers", value: data.analytics.activeDrivers, format: "number" },
      { label: "With Assigned Truck", value: data.analytics.driversWithTruck, format: "number" },
      { label: "Total Trips Completed", value: data.analytics.totalTrips, format: "number" },
    ],
    sections: [
      {
        title: "Driver Details",
        columns: [
          { header: "Name", key: "name", align: "left" },
          { header: "Phone", key: "phone", align: "left" },
          { header: "License No.", key: "licenseNumber", align: "left" },
          { header: "Status", key: "status", align: "center" },
          { header: "Assigned Truck", key: "assignedTruck", align: "left" },
          { header: "Trips", key: "trips", format: "number", align: "center" },
        ],
        data: data.drivers.map((d) => ({
          name: d.name,
          phone: d.phone,
          licenseNumber: d.licenseNumber,
          status: d.status,
          assignedTruck: d.assignedTruck || "Unassigned",
          trips: d.trips,
        })),
        showTotal: true,
        totalLabel: "Total",
        totalColumns: ["trips"],
      },
    ],
    notes: [
      "This report contains driver information as of the report date.",
      "Trip counts reflect completed trips during the reporting period.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Trip Report PDF (for analytics export)
 */
export function generateTripReportPDF(data: {
  trips: Array<{
    origin: string;
    destination: string;
    truck: string;
    driver: string;
    status: string;
    revenue: number;
    date: Date | string;
  }>;
  analytics: {
    totalTrips: number;
    completedTrips: number;
    totalRevenue: number;
    totalMileage: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Trip Report",
    subtitle: "Operational Trip Analysis",
    reportType: "trip-report",
    period: data.period,
    summary: [
      { label: "Total Trips", value: data.analytics.totalTrips, format: "number" },
      { label: "Completed Trips", value: data.analytics.completedTrips, format: "number" },
      { label: "Total Revenue", value: data.analytics.totalRevenue, format: "currency" },
      { label: "Total Mileage", value: data.analytics.totalMileage, format: "number" },
    ],
    sections: [
      {
        title: "Trip Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Origin", key: "origin", align: "left" },
          { header: "Destination", key: "destination", align: "left" },
          { header: "Truck", key: "truck", align: "left" },
          { header: "Driver", key: "driver", align: "left" },
          { header: "Status", key: "status", align: "center" },
          { header: "Revenue", key: "revenue", format: "currency", align: "right" },
        ],
        data: data.trips.map((t) => ({
          date: t.date,
          origin: t.origin,
          destination: t.destination,
          truck: t.truck,
          driver: t.driver,
          status: t.status,
          revenue: t.revenue,
        })),
        showTotal: true,
        totalLabel: "Total",
        totalColumns: ["revenue"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Trip status reflects the current state at the time of report generation.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate an Operations Expense Report PDF
 */
export function generateOperationsExpenseReportPDF(data: {
  expenses: Array<{
    description: string;
    amount: number;
    date: Date | string;
    status: string;
    category: string;
    tripTruck: string;
  }>;
  analytics: {
    totalExpenses: number;
    totalAmount: number;
    pendingAmount: number;
    paidAmount: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
  categoryName?: string;
}): Uint8Array {
  const config: ReportConfig = {
    title: data.categoryName ? `${data.categoryName} Expenses Report` : "Operations Expense Report",
    subtitle: data.categoryName ? `Expenses for ${data.categoryName} Category` : "Trip and Fleet Expenses",
    reportType: "operations-expense",
    period: data.period,
    summary: [
      { label: "Total Expenses", value: data.analytics.totalExpenses, format: "number" },
      { label: "Total Amount", value: data.analytics.totalAmount, format: "currency" },
      { label: "Pending Amount", value: data.analytics.pendingAmount, format: "currency" },
      { label: "Paid Amount", value: data.analytics.paidAmount, format: "currency" },
    ],
    sections: [
      {
        title: "Expense Details",
        columns: [
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Description", key: "description", align: "left" },
          { header: "Category", key: "category", align: "left" },
          { header: "Trip/Truck", key: "tripTruck", align: "left" },
          { header: "Status", key: "status", align: "center" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.expenses.map((e) => ({
          date: e.date,
          description: e.description,
          category: e.category,
          tripTruck: e.tripTruck || "N/A",
          status: e.status,
          amount: e.amount,
        })),
        showTotal: true,
        totalLabel: "Total",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Expenses are linked to their respective trips or fleet units.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Truck Fleet Report PDF
 */
export function generateTruckReportPDF(data: {
  trucks: Array<{
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    status: string;
    currentMileage: number;
    fuelType: string;
    assignedDriver: string;
    trips: number;
    revenue?: number;
    expenses?: number;
    profitLoss?: number;
  }>;
  analytics: {
    totalTrucks: number;
    activeTrucks: number;
    trucksWithDriver: number;
    totalMileage: number;
    totalTrips: number;
    totalRevenue?: number;
    totalExpenses?: number;
    totalProfitLoss?: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const hasFinancials = data.trucks.length > 0 && data.trucks[0].revenue !== undefined;
  
  const summaryItems: SummaryItem[] = [
    { label: "Total Trucks", value: data.analytics.totalTrucks, format: "number" },
    { label: "Active Trucks", value: data.analytics.activeTrucks, format: "number" },
    { label: "With Assigned Driver", value: data.analytics.trucksWithDriver, format: "number" },
    { label: "Total Mileage", value: data.analytics.totalMileage, format: "number" },
    { label: "Total Trips", value: data.analytics.totalTrips, format: "number" },
  ];
  
  if (hasFinancials && data.analytics.totalRevenue !== undefined) {
    summaryItems.push(
      { label: "Total Revenue", value: data.analytics.totalRevenue, format: "currency" },
      { label: "Total Expenses", value: data.analytics.totalExpenses || 0, format: "currency" },
      { label: "Total Profit/Loss", value: data.analytics.totalProfitLoss || 0, format: "currency" }
    );
  }

  const columns: ReportColumn[] = [
    { header: "Reg. No.", key: "registrationNo", align: "left" },
    { header: "Make/Model", key: "makeModel", align: "left" },
    { header: "Status", key: "status", align: "center" },
    { header: "Mileage", key: "currentMileage", format: "number", align: "right" },
    { header: "Driver", key: "assignedDriver", align: "left" },
    { header: "Trips", key: "trips", format: "number", align: "center" },
  ];
  
  const totalColumns = ["currentMileage", "trips"];
  
  if (hasFinancials) {
    columns.push(
      { header: "Revenue", key: "revenue", format: "currency", align: "right" },
      { header: "Expenses", key: "expenses", format: "currency", align: "right" },
      { header: "Profit/Loss", key: "profitLoss", format: "currency", align: "right" }
    );
    totalColumns.push("revenue", "expenses", "profitLoss");
  }

  const config: ReportConfig = {
    title: "Fleet Truck Report",
    subtitle: "Vehicle Inventory, Status & Financials",
    reportType: "truck-report",
    period: data.period,
    summary: summaryItems,
    sections: [
      {
        title: "Truck Details",
        columns,
        data: data.trucks.map((t) => ({
          registrationNo: t.registrationNo,
          makeModel: `${t.make} ${t.model}`,
          year: t.year,
          status: t.status.replace(/_/g, " "),
          currentMileage: t.currentMileage,
          fuelType: t.fuelType || "N/A",
          assignedDriver: t.assignedDriver || "Unassigned",
          trips: t.trips,
          revenue: t.revenue || 0,
          expenses: t.expenses || 0,
          profitLoss: t.profitLoss || 0,
        })),
        showTotal: true,
        totalLabel: "Totals",
        totalColumns,
      },
    ],
    notes: [
      "Mileage figures reflect odometer readings at the time of report generation.",
      "Trip counts and financials include all data during the reporting period.",
      "Profit/Loss = Revenue - Expenses for each truck.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Customer Report PDF
 */
export function generateCustomerReportPDF(data: {
  customers: Array<{
    name: string;
    contactPerson: string;
    email: string;
    phone: string;
    address: string;
    trips: number;
    invoices: number;
    totalRevenue: number;
  }>;
  analytics: {
    totalCustomers: number;
    customersWithTrips: number;
    totalTrips: number;
    totalInvoices: number;
    totalRevenue: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Customer Report",
    subtitle: "Client Overview & Activity",
    reportType: "customer-report",
    period: data.period,
    summary: [
      { label: "Total Customers", value: data.analytics.totalCustomers, format: "number" },
      { label: "Active Customers", value: data.analytics.customersWithTrips, format: "number" },
      { label: "Total Trips", value: data.analytics.totalTrips, format: "number" },
      { label: "Total Invoices", value: data.analytics.totalInvoices, format: "number" },
      { label: "Total Revenue", value: data.analytics.totalRevenue, format: "currency" },
    ],
    sections: [
      {
        title: "Customer Details",
        columns: [
          { header: "Company Name", key: "name", align: "left" },
          { header: "Contact Person", key: "contactPerson", align: "left" },
          { header: "Email", key: "email", align: "left" },
          { header: "Phone", key: "phone", align: "left" },
          { header: "Trips", key: "trips", format: "number", align: "center" },
          { header: "Invoices", key: "invoices", format: "number", align: "center" },
          { header: "Revenue", key: "totalRevenue", format: "currency", align: "right" },
        ],
        data: data.customers.map((c) => ({
          name: c.name,
          contactPerson: c.contactPerson || "N/A",
          email: c.email || "N/A",
          phone: c.phone || "N/A",
          trips: c.trips,
          invoices: c.invoices,
          totalRevenue: c.totalRevenue,
        })),
        showTotal: true,
        totalLabel: "Totals",
        totalColumns: ["trips", "invoices", "totalRevenue"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Revenue figures reflect total invoiced amounts for the reporting period.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate an Invoices Report PDF
 */
export function generateInvoiceReportPDF(data: {
  invoices: Array<{
    invoiceNumber: string;
    customer: string;
    issueDate: Date | string;
    dueDate: Date | string | null;
    total: number;
    amountPaid: number;
    balance: number;
    status: string;
  }>;
  analytics: {
    totalInvoices: number;
    totalValue: number;
    totalPaid: number;
    totalBalance: number;
    paidCount: number;
    overdueCount: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Invoices Report",
    subtitle: "Invoice Status & Payment Summary",
    reportType: "invoice-report",
    period: data.period,
    summary: [
      { label: "Total Invoices", value: data.analytics.totalInvoices, format: "number" },
      { label: "Total Value", value: data.analytics.totalValue, format: "currency" },
      { label: "Amount Paid", value: data.analytics.totalPaid, format: "currency" },
      { label: "Outstanding Balance", value: data.analytics.totalBalance, format: "currency" },
      { label: "Paid Count", value: data.analytics.paidCount, format: "number" },
      { label: "Overdue Count", value: data.analytics.overdueCount, format: "number" },
    ],
    sections: [
      {
        title: "Invoice Details",
        columns: [
          { header: "Invoice #", key: "invoiceNumber", align: "left" },
          { header: "Customer", key: "customer", align: "left" },
          { header: "Issue Date", key: "issueDate", format: "date", align: "center" },
          { header: "Due Date", key: "dueDate", format: "date", align: "center" },
          { header: "Status", key: "status", align: "center" },
          { header: "Total", key: "total", format: "currency", align: "right" },
          { header: "Paid", key: "amountPaid", format: "currency", align: "right" },
          { header: "Balance", key: "balance", format: "currency", align: "right" },
        ],
        data: data.invoices.map((inv) => ({
          invoiceNumber: inv.invoiceNumber,
          customer: inv.customer,
          issueDate: inv.issueDate,
          dueDate: inv.dueDate,
          status: inv.status.replace(/_/g, " "),
          total: inv.total,
          amountPaid: inv.amountPaid,
          balance: inv.balance,
        })),
        showTotal: true,
        totalLabel: "Totals",
        totalColumns: ["total", "amountPaid", "balance"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Balance = Total - Amount Paid.",
      "Overdue invoices are those with due dates in the past and unpaid balance.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Payments Report PDF
 */
export function generatePaymentReportPDF(data: {
  payments: Array<{
    invoiceNumber: string;
    customer: string;
    amount: number;
    paymentDate: Date | string;
    method: string;
    reference: string;
  }>;
  analytics: {
    totalPayments: number;
    totalAmount: number;
    averageAmount: number;
    paymentMethods: { [key: string]: number };
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Payments Report",
    subtitle: "Payment Transactions & Collection Summary",
    reportType: "payment-report",
    period: data.period,
    summary: [
      { label: "Total Payments", value: data.analytics.totalPayments, format: "number" },
      { label: "Total Amount", value: data.analytics.totalAmount, format: "currency" },
      { label: "Average Payment", value: data.analytics.averageAmount, format: "currency" },
    ],
    sections: [
      {
        title: "Payment Details",
        columns: [
          { header: "Invoice #", key: "invoiceNumber", align: "left" },
          { header: "Customer", key: "customer", align: "left" },
          { header: "Payment Date", key: "paymentDate", format: "date", align: "center" },
          { header: "Method", key: "method", align: "center" },
          { header: "Reference", key: "reference", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.payments.map((pmt) => ({
          invoiceNumber: pmt.invoiceNumber,
          customer: pmt.customer,
          paymentDate: pmt.paymentDate,
          method: pmt.method,
          reference: pmt.reference || "N/A",
          amount: pmt.amount,
        })),
        showTotal: true,
        totalLabel: "Total",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Payment methods tracked for business analysis and reconciliation.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate an Employees Report PDF
 */
export function generateEmployeeReportPDF(data: {
  employees: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    position: string;
    department: string;
    status: string;
    startDate: Date | string;
  }>;
  analytics: {
    totalEmployees: number;
    activeEmployees: number;
    byDepartment: { [key: string]: number };
    byPosition: { [key: string]: number };
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Employees Report",
    subtitle: "Staff Directory & Employment Summary",
    reportType: "employee-report",
    period: data.period,
    summary: [
      { label: "Total Employees", value: data.analytics.totalEmployees, format: "number" },
      { label: "Active Employees", value: data.analytics.activeEmployees, format: "number" },
    ],
    sections: [
      {
        title: "Employee Details",
        columns: [
          { header: "Name", key: "fullName", align: "left" },
          { header: "Position", key: "position", align: "left" },
          { header: "Department", key: "department", align: "left" },
          { header: "Email", key: "email", align: "left" },
          { header: "Phone", key: "phone", align: "left" },
          { header: "Status", key: "status", align: "center" },
          { header: "Start Date", key: "startDate", format: "date", align: "center" },
        ],
        data: data.employees.map((emp) => ({
          fullName: `${emp.firstName} ${emp.lastName}`,
          position: emp.position,
          department: emp.department || "N/A",
          email: emp.email || "N/A",
          phone: emp.phone || "N/A",
          status: emp.status.replace(/_/g, " "),
          startDate: emp.startDate,
        })),
        showTotal: false,
      },
    ],
    notes: [
      "Employee status reflects current employment status as of report date.",
      "Department and position information current as of the reporting period.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Dashboard Summary PDF
 */
export function generateDashboardSummaryPDF(data: {
  totalTrucks: number;
  activeTrucks: number;
  totalDrivers: number;
  activeDrivers: number;
  thisMonthTrips: number;
  lastMonthTrips: number;
  completedTrips: number;
  inProgressTrips: number;
  thisMonthInvoiceTotal: number;
  lastMonthInvoiceTotal: number;
  thisMonthPaymentTotal: number;
  lastMonthPaymentTotal: number;
  thisMonthExpenseTotal: number;
  lastMonthExpenseTotal: number;
  outstandingInvoices: { invoiceNumber: string; total: number; dueDate: Date | null; customer: { name: string } }[];
  topCustomersByRevenue: { name: string; revenue: number }[];
  expensesWithCategories: { category: string; amount: number }[];
}) {
  const config: ReportConfig = {
    title: "Dashboard Summary Report",
    subtitle: "Organization Performance Overview",
    reportType: "dashboard-summary",
    period: {
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date(),
    },
    summary: [
      { label: "Total Trucks", value: data.totalTrucks.toString() },
      { label: "Active Trucks", value: data.activeTrucks.toString() },
      { label: "Total Drivers", value: data.totalDrivers.toString() },
      { label: "Active Drivers", value: data.activeDrivers.toString() },
    ],
    sections: [
      {
        title: "Fleet Management",
        rows: [
          { label: "Total Trucks", value: data.totalTrucks },
          { label: "Active Trucks", value: data.activeTrucks },
          { label: "Inactive Trucks", value: data.totalTrucks - data.activeTrucks },
          { label: "Total Drivers", value: data.totalDrivers },
          { label: "Active Drivers", value: data.activeDrivers },
          { label: "Inactive Drivers", value: data.totalDrivers - data.activeDrivers },
        ],
        showTotal: false,
      },
      {
        title: "Trip Operations",
        rows: [
          { label: "This Month Trips", value: data.thisMonthTrips },
          { label: "Last Month Trips", value: data.lastMonthTrips },
          { label: "Completed Trips", value: data.completedTrips },
          { label: "In Progress Trips", value: data.inProgressTrips },
        ],
        showTotal: false,
      },
      {
        title: "Financial Summary",
        rows: [
          { label: "This Month Invoices", value: data.thisMonthInvoiceTotal, isCurrency: true },
          { label: "Last Month Invoices", value: data.lastMonthInvoiceTotal, isCurrency: true },
          { label: "This Month Payments", value: data.thisMonthPaymentTotal, isCurrency: true },
          { label: "Last Month Payments", value: data.lastMonthPaymentTotal, isCurrency: true },
          { label: "This Month Expenses", value: data.thisMonthExpenseTotal, isCurrency: true },
          { label: "Last Month Expenses", value: data.lastMonthExpenseTotal, isCurrency: true },
        ],
        showTotal: false,
      },
      {
        title: "Top Customers by Revenue",
        rows: data.topCustomersByRevenue.map((customer) => ({
          label: customer.name,
          value: customer.revenue,
          isCurrency: true,
        })),
        showTotal: true,
      },
      {
        title: "Expense Breakdown",
        rows: data.expensesWithCategories.map((expense) => ({
          label: expense.category,
          value: expense.amount,
          isCurrency: true,
        })),
        showTotal: true,
      },
      {
        title: "Outstanding Invoices",
        rows: data.outstandingInvoices.map((invoice) => ({
          label: `${invoice.customer.name} (Invoice #${invoice.invoiceNumber})`,
          value: invoice.total,
          isCurrency: true,
        })),
        showTotal: true,
      },
    ],
    notes: [
      "This dashboard summary provides an overview of key business metrics.",
      "All figures are current as of the report generation date.",
      "Financial figures are in the organization's base currency.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Trip Profit/Loss PDF for a single trip
 */
export function generateTripProfitLossPDF(data: {
  trip: {
    tripNumber?: string;
    origin: string;
    destination: string;
    startDate: Date | string;
    endDate?: Date | string | null;
    status: string;
    truck?: string | null;
    driver?: string | null;
  };
  expenses: Array<{
    description: string | null;
    category: string | null;
    date: Date | string;
    amount: number;
  }>;
  invoice?: {
    invoiceNumber: string;
    total: number;
    amountPaid: number;
    balance: number;
    status: string;
    isCredit: boolean;
  } | null;
  revenue: number;
}): Uint8Array {
  const totalExpenses = data.expenses.reduce((sum, e) => sum + e.amount, 0);
  const grossProfit = data.revenue - totalExpenses;
  const isInvoicePaid = data.invoice?.status === "paid";
  const netProfit = isInvoicePaid ? grossProfit : 0;
  const pendingAmount = data.invoice ? data.invoice.balance : data.revenue;

  const tripTitle = data.trip.tripNumber
    ? `Trip #${data.trip.tripNumber} Profit/Loss Report`
    : "Trip Profit/Loss Report";
  const routeSubtitle = `${data.trip.origin} → ${data.trip.destination}`;

  const config: ReportConfig = {
    title: tripTitle,
    subtitle: routeSubtitle,
    reportType: "trip-profit-loss",
    period: {
      startDate: data.trip.startDate,
      endDate: data.trip.endDate || data.trip.startDate,
    },
    summary: [
      { label: "Trip Status", value: data.trip.status, format: "text" },
      { label: "Truck", value: data.trip.truck || "Not Assigned", format: "text" },
      { label: "Driver", value: data.trip.driver || "Not Assigned", format: "text" },
      { label: "Total Revenue", value: data.revenue, format: "currency" },
      { label: "Total Expenses", value: totalExpenses, format: "currency" },
      { label: "Gross Profit", value: grossProfit, format: "currency" },
      ...(data.invoice
        ? [
            { label: "Invoice Number", value: data.invoice.invoiceNumber, format: "text" as const },
            { label: "Invoice Status", value: data.invoice.status, format: "text" as const },
            { label: "Amount Paid", value: data.invoice.amountPaid, format: "currency" as const },
            { label: "Balance Due", value: data.invoice.balance, format: "currency" as const },
          ]
        : []),
    ],
    sections: [
      // Revenue Section
      {
        title: "Revenue",
        columns: [
          { header: "Description", key: "description", align: "left" },
          { header: "Type", key: "type", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: [
          {
            description: data.invoice
              ? `Invoice ${data.invoice.invoiceNumber}`
              : "Trip Revenue",
            type: data.invoice
              ? data.invoice.isCredit
                ? "Credit Invoice"
                : isInvoicePaid
                ? "Paid Invoice"
                : "Pending Invoice"
              : "Revenue",
            amount: data.revenue,
          },
        ],
        showTotal: true,
        totalLabel: "Total Revenue",
        totalColumns: ["amount"],
      },
      // Expenses Section
      {
        title: "Expenses",
        columns: [
          { header: "Description", key: "description", align: "left" },
          { header: "Category", key: "category", align: "left" },
          { header: "Date", key: "date", format: "date", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data:
          data.expenses.length > 0
            ? data.expenses.map((e) => ({
                description: e.description || "Expense",
                category: e.category || "Uncategorized",
                date: e.date,
                amount: e.amount,
              }))
            : [
                {
                  description: "No expenses recorded",
                  category: "-",
                  date: "-",
                  amount: 0,
                },
              ],
        showTotal: true,
        totalLabel: "Total Expenses",
        totalColumns: ["amount"],
      },
      // Profit/Loss Summary Section
      {
        title: "Profit/Loss Summary",
        columns: [
          { header: "Description", key: "description", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: [
          { description: "Total Revenue", amount: data.revenue },
          { description: "Less: Total Expenses", amount: -totalExpenses },
          { description: "Gross Profit/(Loss)", amount: grossProfit },
          ...(data.invoice
            ? [
                {
                  description: isInvoicePaid
                    ? "Net Profit (Collected)"
                    : `Pending Collection`,
                  amount: isInvoicePaid ? netProfit : pendingAmount,
                },
              ]
            : []),
        ],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Gross Profit is calculated as Revenue minus Expenses.",
      data.invoice
        ? isInvoicePaid
          ? "Invoice has been fully paid."
          : `Outstanding balance of ${formatCurrency(pendingAmount)} remains to be collected.`
        : "No invoice has been generated for this trip.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}