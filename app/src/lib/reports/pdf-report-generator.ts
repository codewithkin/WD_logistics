/**
 * Plain PDF Report Generator using jsPDF
 * 
 * Simple, clean formatting like a Word 2007 document.
 * Professional accounting style with basic tables and clear text.
 */

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import {
  createDocument,
  dateRangeLabel,
  drawHeader,
  drawKpiRow,
  drawNotes,
  drawPeriodLine,
  drawTable,
  finalise,
  shortDate as kitShortDate,
  type OrganizationLike,
} from "@/lib/documents/kit";

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
  /** Tabular form. Omit when using `rows`. */
  columns?: ReportColumn[];
  data?: Record<string, unknown>[];
  /**
   * The simple label/value form, for sections that are a list of figures
   * rather than a table — the dashboard summary's "Fleet Management" block,
   * say. Several call sites were already passing this shape; the type never
   * admitted it, so those sections were a type error that shipped and drew
   * nothing.
   */
  rows?: Array<{
    label: string;
    value: string | number;
    /** Formats the value as money rather than a plain number. */
    isCurrency?: boolean;
  }>;
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

/**
 * Renders a ReportConfig onto the shared document kit.
 *
 * This class used to draw its own black-and-white, Times-set "accounting"
 * layout — which is why every report, statement and list export in the app
 * looked nothing like the receipt the client praised. The public surface is
 * deliberately unchanged (construct with a ReportConfig, call generate), so
 * the ~25 existing callers were restyled without being edited.
 *
 * The signature block the old renderer put on every report is gone. A report
 * is an internal document; nobody signs a fleet utilisation summary. The
 * invoice and receipt, which genuinely are handed over, keep theirs.
 */
export class PDFReportGenerator {
  private config: ReportConfig;
  private organization: OrganizationLike | null;

  constructor(config: ReportConfig, organization?: OrganizationLike | null) {
    this.config = {
      companyName: "WD Logistics",
      ...config,
    };
    this.organization = organization ?? null;
  }

  /** Formats a cell according to its column's declared format. */
  private formatCell(value: unknown, format?: ReportColumn["format"]): string {
    if (value === null || value === undefined || value === "") return "—";

    switch (format) {
      case "currency":
        return formatCurrency(value as number);
      case "percentage":
        return formatPercentage(value as number);
      case "number":
        return formatNumber(value as number);
      case "date":
        return kitShortDate(value as Date | string);
      default:
        return String(value);
    }
  }

  public generate(): Uint8Array {
    const ctx = createDocument({
      organization: this.organization,
      title: this.config.title,
    });

    drawHeader(ctx, {
      title: this.config.title,
      metaLines: this.config.subtitle ? [this.config.subtitle] : [],
    });

    drawPeriodLine(
      ctx,
      `Period: ${dateRangeLabel(
        this.config.period.startDate,
        this.config.period.endDate,
      )}`,
    );

    // The summary becomes the KPI row across the top, which is the figure
    // set a reader wants before any table.
    if (this.config.summary && this.config.summary.length > 0) {
      drawKpiRow(
        ctx,
        this.config.summary.map((item) => ({
          label: item.label,
          value:
            item.format === "currency"
              ? formatCurrency(item.value as number)
              : item.format === "percentage"
                ? formatPercentage(item.value as number)
                : item.format === "number"
                  ? formatNumber(item.value as number)
                  : String(item.value),
        })),
      );
    }

    for (const section of this.config.sections) {
      // The label/value form renders as a two-column table, which keeps one
      // table style across the whole document.
      if (section.rows) {
        drawTable(
          ctx,
          [
            { header: "Item", key: "label" },
            { header: "Value", key: "value", align: "right", width: 40 },
          ],
          section.rows.map((row) => ({
            label: row.label,
            value: row.isCurrency
              ? formatCurrency(row.value as number)
              : typeof row.value === "number"
                ? formatNumber(row.value)
                : row.value,
          })),
          { title: section.title, emptyMessage: "Nothing recorded." },
        );
        continue;
      }

      const columns = section.columns ?? [];
      const data = section.data ?? [];

      // A section with no rows says so rather than printing a bare header,
      // which used to look like the report had failed.
      const rows = data.map((row) => {
        const mapped: Record<string, string | number> = {};
        for (const column of columns) {
          mapped[column.key] = this.formatCell(row[column.key], column.format);
        }
        return mapped;
      });

      let foot: Array<string | number> | undefined;
      if (section.showTotal && data.length > 0) {
        const totalColumns = new Set(section.totalColumns ?? []);
        foot = columns.map((column, index) => {
          if (index === 0) return section.totalLabel ?? "Total";
          if (!totalColumns.has(column.key)) return "";
          const sum = data.reduce((total, row) => {
            const value = row[column.key];
            const numeric =
              typeof value === "number" ? value : parseFloat(String(value));
            return total + (Number.isNaN(numeric) ? 0 : numeric);
          }, 0);
          return this.formatCell(sum, column.format);
        });
      }

      drawTable(
        ctx,
        columns.map((column) => ({
          header: column.header,
          key: column.key,
          align:
            column.align ??
            (column.format === "currency" ||
            column.format === "number" ||
            column.format === "percentage"
              ? "right"
              : "left"),
          width: column.width,
        })),
        rows,
        {
          title: section.title,
          foot,
          emptyMessage: "No data for this period.",
        },
      );
    }

    if (this.config.notes && this.config.notes.length > 0) {
      drawNotes(ctx, "Notes", this.config.notes.join("\n"));
    }

    return finalise(ctx, { docNo: this.config.title });
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
 * Generate a Truck Profitability Report PDF
 */
export function generateTruckProfitabilityPDF(data: {
  truck: { registrationNo: string; make: string; model: string };
  trips: number;
  revenue: number;
  expensesByCategory: Array<{ category: string; amount: number }>;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Truck Profitability Report",
    subtitle: `${data.truck.registrationNo} - ${data.truck.make} ${data.truck.model}`,
    reportType: "truck-profitability",
    period: data.period,
    summary: [
      { label: "Trips Completed", value: data.trips, format: "number" },
      { label: "Revenue", value: data.revenue, format: "currency" },
      { label: "Total Expenses", value: data.totalExpenses, format: "currency" },
      { label: "Net Profit", value: data.profit, format: "currency" },
      { label: "Profit Margin", value: data.profitMargin, format: "percentage" },
    ],
    sections: [
      {
        title: "Expense Breakdown by Category",
        columns: [
          { header: "Category", key: "category", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.expensesByCategory,
        showTotal: true,
        totalLabel: "Total Expenses",
        totalColumns: ["amount"],
      },
    ],
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Revenue is derived from completed trips assigned to this truck within the period.",
      "Net Profit is calculated as Revenue minus Total Expenses across all categories.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate an Account Ledger Report PDF — a running ledger and P&L view
 * for Cash/Bank/Petty Cash: opening balance -> usage -> remaining, plus a
 * spend breakdown, one section per account.
 */
export function generateAccountLedgerPDF(data: {
  accounts: Array<{
    accountName: string;
    openingBalance: number;
    totalDebits: number;
    totalCredits: number;
    closingBalance: number;
    expenseBreakdown: Array<{ description: string; amount: number }>;
  }>;
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const totalOpening = data.accounts.reduce((sum, a) => sum + a.openingBalance, 0);
  const totalDebits = data.accounts.reduce((sum, a) => sum + a.totalDebits, 0);
  const totalCredits = data.accounts.reduce((sum, a) => sum + a.totalCredits, 0);
  const totalClosing = data.accounts.reduce((sum, a) => sum + a.closingBalance, 0);

  const config: ReportConfig = {
    title: "Account Ledger Report",
    subtitle: "Cash / Bank / Petty Cash — Opening Balance, Usage, Remaining",
    reportType: "account-ledger",
    period: data.period,
    summary: [
      { label: "Combined Opening Balance", value: totalOpening, format: "currency" },
      { label: "Combined Usage (Debits)", value: totalDebits, format: "currency" },
      { label: "Combined Credits", value: totalCredits, format: "currency" },
      { label: "Combined Closing Balance", value: totalClosing, format: "currency" },
    ],
    sections: data.accounts.map((account) => ({
      title: `${account.accountName} — Opening ${account.openingBalance.toFixed(2)} -> Closing ${account.closingBalance.toFixed(2)}`,
      columns: [
        { header: "Description", key: "description", align: "left" },
        { header: "Amount", key: "amount", format: "currency", align: "right" },
      ],
      data: account.expenseBreakdown,
      showTotal: true,
      totalLabel: "Total Usage",
      totalColumns: ["amount"],
    })),
    notes: [
      "All amounts are in United States Dollars (USD).",
      "Revenue never touches these accounts — only expenses and transfers between Cash and Petty Cash do.",
      "Opening/closing balances are exact ledger snapshots, not recomputed sums.",
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
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: data.payments.map((pmt) => ({
          invoiceNumber: pmt.invoiceNumber,
          customer: pmt.customer,
          paymentDate: pmt.paymentDate,
          method: pmt.method,
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
  /** The window the caller actually charted; printed in the header. */
  period?: { startDate: Date; endDate: Date };
}) {
  const config: ReportConfig = {
    title: "Dashboard Summary Report",
    subtitle: "Organization Performance Overview",
    reportType: "dashboard-summary",
    period: data.period ?? {
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

/**
 * Generate a Single Driver Report PDF (for individual driver export)
 */
export function generateSingleDriverReportPDF(data: {
  driver: {
    name: string;
    phone: string;
    email: string;
    licenseNumber: string;
    licenseExpiration: string;
    passportNumber: string;
    passportExpiration: string;
    status: string;
    assignedTruck: string;
    startDate: string;
    notes: string;
  };
  stats: {
    totalTrips: number;
    completedTrips: number;
    inProgressTrips: number;
    totalExpenses: number;
  };
  trips: Array<{
    route: string;
    date: string;
    status: string;
    truck: string;
  }>;
  expenses: Array<{
    date: string;
    type: string;
    amount: number;
    description: string;
  }>;
}): Uint8Array {
  const config: ReportConfig = {
    title: "Driver Report",
    subtitle: data.driver.name,
    reportType: "single-driver-report",
    period: {
      startDate: new Date(data.driver.startDate || Date.now()),
      endDate: new Date(),
    },
    summary: [
      { label: "Total Trips", value: data.stats.totalTrips, format: "number" },
      { label: "Completed Trips", value: data.stats.completedTrips, format: "number" },
      { label: "In Progress", value: data.stats.inProgressTrips, format: "number" },
      { label: "Total Expenses", value: data.stats.totalExpenses, format: "currency" },
    ],
    sections: [
      {
        title: "Driver Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Full Name", value: data.driver.name },
          { field: "Phone", value: data.driver.phone },
          { field: "Email", value: data.driver.email },
          { field: "Status", value: data.driver.status },
          { field: "Assigned Truck", value: data.driver.assignedTruck },
          { field: "Start Date", value: data.driver.startDate },
          { field: "License Number", value: data.driver.licenseNumber },
          { field: "License Expiration", value: data.driver.licenseExpiration },
          { field: "Passport Number", value: data.driver.passportNumber },
          { field: "Passport Expiration", value: data.driver.passportExpiration },
        ],
      },
      ...(data.trips.length > 0
        ? [
            {
              title: "Recent Trips",
              columns: [
                { header: "Route", key: "route", align: "left" as const },
                { header: "Date", key: "date", align: "center" as const },
                { header: "Status", key: "status", align: "center" as const },
                { header: "Truck", key: "truck", align: "left" as const },
              ],
              data: data.trips,
            },
          ]
        : []),
      ...(data.expenses.length > 0
        ? [
            {
              title: "Recent Expenses",
              columns: [
                { header: "Date", key: "date", align: "center" as const },
                { header: "Type", key: "type", align: "left" as const },
                { header: "Amount", key: "amount", format: "currency" as const, align: "right" as const },
                { header: "Description", key: "description", align: "left" as const },
              ],
              data: data.expenses,
              showTotal: true,
              totalLabel: "Total Expenses",
              totalColumns: ["amount"],
            },
          ]
        : []),
    ],
    notes: data.driver.notes
      ? [
          "Driver Notes:",
          data.driver.notes,
        ]
      : ["This report contains driver information as of the report date."],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Single Truck Report PDF (for individual truck export)
 */
export function generateSingleTruckReportPDF(data: {
  truck: {
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    status: string;
    currentMileage: number;
    fuelType: string;
    tankCapacity: number;
    assignedDriver: string;
    notes: string;
  };
  stats: {
    totalTrips: number;
    completedTrips: number;
    inProgressTrips: number;
    totalRevenue: number;
    totalExpenses: number;
    profitLoss: number;
  };
  trips: Array<{
    route: string;
    date: string;
    status: string;
    driver: string;
  }>;
  expenses: Array<{
    date: string;
    type: string;
    amount: number;
    description: string;
  }>;
}): Uint8Array {
  const config: ReportConfig = {
    title: "Truck Report",
    subtitle: `${data.truck.make} ${data.truck.model} (${data.truck.registrationNo})`,
    reportType: "single-truck-report",
    period: {
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date(),
    },
    summary: [
      { label: "Total Trips", value: data.stats.totalTrips, format: "number" },
      { label: "Completed Trips", value: data.stats.completedTrips, format: "number" },
      { label: "In Progress", value: data.stats.inProgressTrips, format: "number" },
      { label: "Total Revenue", value: data.stats.totalRevenue, format: "currency" },
      { label: "Total Expenses", value: data.stats.totalExpenses, format: "currency" },
      { label: "Profit/Loss", value: data.stats.profitLoss, format: "currency" },
    ],
    sections: [
      {
        title: "Truck Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Registration No.", value: data.truck.registrationNo },
          { field: "Make", value: data.truck.make },
          { field: "Model", value: data.truck.model },
          { field: "Year", value: data.truck.year },
          { field: "Status", value: data.truck.status },
          { field: "Current Mileage", value: data.truck.currentMileage },
          { field: "Fuel Type", value: data.truck.fuelType },
          { field: "Tank Capacity", value: `${data.truck.tankCapacity} L` },
          { field: "Assigned Driver", value: data.truck.assignedDriver },
        ],
      },
      ...(data.trips.length > 0
        ? [
            {
              title: "Recent Trips",
              columns: [
                { header: "Route", key: "route", align: "left" as const },
                { header: "Date", key: "date", align: "center" as const },
                { header: "Status", key: "status", align: "center" as const },
                { header: "Driver", key: "driver", align: "left" as const },
              ],
              data: data.trips,
            },
          ]
        : []),
      ...(data.expenses.length > 0
        ? [
            {
              title: "Recent Expenses",
              columns: [
                { header: "Date", key: "date", align: "center" as const },
                { header: "Type", key: "type", align: "left" as const },
                { header: "Amount", key: "amount", format: "currency" as const, align: "right" as const },
                { header: "Description", key: "description", align: "left" as const },
              ],
              data: data.expenses,
              showTotal: true,
              totalLabel: "Total Expenses",
              totalColumns: ["amount"],
            },
          ]
        : []),
    ],
    notes: data.truck.notes
      ? [
          "Truck Notes:",
          data.truck.notes,
        ]
      : ["This report contains truck information as of the report date."],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Single Trip Report PDF (for individual trip export)
 */
export function generateSingleTripReportPDF(data: {
  trip: {
    originCity: string;
    originAddress: string;
    destinationCity: string;
    destinationAddress: string;
    loadDescription: string;
    loadWeight: number;
    status: string;
    scheduledDate: string;
    startDate: string;
    endDate: string;
    truck: string;
    driver: string;
    customer: string;
  };
  financials: {
    revenue: number;
    expenses: number;
    grossProfit: number;
    netProfit: number;
    invoiceNumber: string;
    invoiceStatus: string;
    invoiceTotal: number;
    invoicePaid: number;
    invoiceBalance: number;
  };
  mileage: {
    estimated: number;
    actual: number;
    startOdometer: number;
    endOdometer: number;
  };
  expenses: Array<{
    date: string;
    category: string;
    description: string;
    amount: number;
  }>;
  notes: string;
}): Uint8Array {
  const config: ReportConfig = {
    title: "Trip Report",
    subtitle: `${data.trip.originCity} → ${data.trip.destinationCity}`,
    reportType: "single-trip-report",
    period: {
      startDate: new Date(data.trip.scheduledDate),
      endDate: new Date(data.trip.endDate || data.trip.scheduledDate),
    },
    summary: [
      { label: "Trip Status", value: data.trip.status, format: "text" },
      { label: "Revenue", value: data.financials.revenue, format: "currency" },
      { label: "Total Expenses", value: data.financials.expenses, format: "currency" },
      { label: "Gross Profit", value: data.financials.grossProfit, format: "currency" },
      { label: "Net Profit", value: data.financials.netProfit, format: "currency" },
      { label: "Actual Mileage", value: data.mileage.actual, format: "number" },
    ],
    sections: [
      {
        title: "Trip Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Status", value: data.trip.status },
          { field: "Scheduled Date", value: data.trip.scheduledDate },
          { field: "Start Date", value: data.trip.startDate },
          { field: "End Date", value: data.trip.endDate },
          { field: "Origin", value: `${data.trip.originCity}, ${data.trip.originAddress}` },
          { field: "Destination", value: `${data.trip.destinationCity}, ${data.trip.destinationAddress}` },
          { field: "Load Description", value: data.trip.loadDescription },
          { field: "Load Weight", value: `${data.trip.loadWeight} units` },
          { field: "Truck", value: data.trip.truck },
          { field: "Driver", value: data.trip.driver },
          { field: "Customer", value: data.trip.customer },
        ],
      },
      {
        title: "Mileage Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Estimated Mileage", value: `${data.mileage.estimated} km` },
          { field: "Actual Mileage", value: `${data.mileage.actual} km` },
          { field: "Start Odometer", value: `${data.mileage.startOdometer} km` },
          { field: "End Odometer", value: `${data.mileage.endOdometer} km` },
        ],
      },
      {
        title: "Financial Summary",
        columns: [
          { header: "Item", key: "item", align: "left" },
          { header: "Amount", key: "amount", align: "right", format: "currency" },
        ],
        data: [
          { item: "Revenue", amount: data.financials.revenue },
          { item: "Total Expenses", amount: data.financials.expenses },
          { item: "Gross Profit", amount: data.financials.grossProfit },
          { item: "Net Profit", amount: data.financials.netProfit },
        ],
      },
      {
        title: "Invoice Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Invoice Number", value: data.financials.invoiceNumber },
          { field: "Invoice Status", value: data.financials.invoiceStatus },
          { field: "Invoice Total", value: `$${data.financials.invoiceTotal.toFixed(2)}` },
          { field: "Amount Paid", value: `$${data.financials.invoicePaid.toFixed(2)}` },
          { field: "Balance", value: `$${data.financials.invoiceBalance.toFixed(2)}` },
        ],
      },
      ...(data.expenses.length > 0
        ? [
            {
              title: "Trip Expenses",
              columns: [
                { header: "Date", key: "date", align: "center" as const },
                { header: "Category", key: "category", align: "left" as const },
                { header: "Description", key: "description", align: "left" as const },
                { header: "Amount", key: "amount", format: "currency" as const, align: "right" as const },
              ],
              data: data.expenses,
              showTotal: true,
              totalLabel: "Total Expenses",
              totalColumns: ["amount"],
            },
          ]
        : []),
    ],
    notes: data.notes
      ? [
          "Trip Notes:",
          data.notes,
        ]
      : ["This report contains trip information as of the report date."],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Single Invoice PDF (for download)
 */
export function generateSingleInvoicePDF(data: {
  invoice: {
    invoiceNumber: string;
    issueDate: Date | string;
    dueDate: Date | string | null;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    amountPaid: number;
    balance: number;
    notes: string | null;
    isCredit: boolean;
  };
  customer: {
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
  };
  organization: {
    name: string;
  };
  trip?: {
    originCity: string;
    destinationCity: string;
    scheduledDate: Date | string;
    loadDescription: string | null;
    truck: string;
    driver: string;
  } | null;
  payments: Array<{
    amount: number;
    paymentDate: Date | string;
    method: string;
    reference: string | null;
  }>;
}): Uint8Array {
  const config: ReportConfig = {
    title: data.invoice.isCredit ? "Credit Invoice" : "Invoice",
    subtitle: data.invoice.invoiceNumber,
    reportType: "single-invoice",
    period: {
      startDate: new Date(data.invoice.issueDate),
      endDate: data.invoice.dueDate ? new Date(data.invoice.dueDate) : new Date(data.invoice.issueDate),
    },
    summary: [
      { label: "Invoice Number", value: data.invoice.invoiceNumber, format: "text" },
      { label: "Status", value: data.invoice.status.replace(/_/g, " ").toUpperCase(), format: "text" },
      { label: "Total Amount", value: data.invoice.total, format: "currency" },
      { label: "Amount Paid", value: data.invoice.amountPaid, format: "currency" },
      { label: "Balance Due", value: data.invoice.balance, format: "currency" },
    ],
    sections: [
      {
        title: "Bill To",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Customer Name", value: data.customer.name },
          { field: "Email", value: data.customer.email || "N/A" },
          { field: "Phone", value: data.customer.phone || "N/A" },
          { field: "Address", value: data.customer.address || "N/A" },
        ],
      },
      {
        title: "Invoice Details",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Issue Date", value: new Date(data.invoice.issueDate).toLocaleDateString() },
          { field: "Due Date", value: data.invoice.dueDate ? new Date(data.invoice.dueDate).toLocaleDateString() : "N/A" },
          { field: "Invoice Type", value: data.invoice.isCredit ? "Credit Invoice" : "Standard Invoice" },
        ],
      },
      ...(data.trip ? [
        {
          title: "Trip Details",
          columns: [
            { header: "Field", key: "field", align: "left" as const },
            { header: "Value", key: "value", align: "left" as const },
          ],
          data: [
            { field: "Route", value: `${data.trip.originCity} → ${data.trip.destinationCity}` },
            { field: "Scheduled Date", value: new Date(data.trip.scheduledDate).toLocaleDateString() },
            { field: "Load Description", value: data.trip.loadDescription || "N/A" },
            { field: "Truck", value: data.trip.truck },
            { field: "Driver", value: data.trip.driver },
          ],
        },
      ] : []),
      {
        title: "Amount Summary",
        columns: [
          { header: "Description", key: "description", align: "left" },
          { header: "Amount", key: "amount", format: "currency", align: "right" },
        ],
        data: [
          { description: "Subtotal", amount: data.invoice.subtotal },
          { description: "Tax", amount: data.invoice.tax },
          { description: "Total", amount: data.invoice.total },
          { description: "Amount Paid", amount: data.invoice.amountPaid },
          { description: "Balance Due", amount: data.invoice.balance },
        ],
      },
      ...(data.payments.length > 0 ? [
        {
          title: "Payment History",
          columns: [
            { header: "Date", key: "date", align: "center" as const },
            { header: "Method", key: "method", align: "left" as const },
            { header: "Reference", key: "reference", align: "left" as const },
            { header: "Amount", key: "amount", format: "currency" as const, align: "right" as const },
          ],
          data: data.payments.map(p => ({
            date: new Date(p.paymentDate).toLocaleDateString(),
            method: p.method.replace(/_/g, " "),
            reference: p.reference || "N/A",
            amount: p.amount,
          })),
          showTotal: true,
          totalLabel: "Total Paid",
          totalColumns: ["amount"],
        },
      ] : []),
    ],
    notes: [
      `Invoice generated by ${data.organization.name}`,
      ...(data.invoice.notes ? [`Notes: ${data.invoice.notes}`] : []),
      "Thank you for your business!",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

// Payment receipts are generated by the dedicated, on-brand
// generatePaymentReceiptPDF in ./receipt-generator.ts, not this class —
// customer-facing receipts get a colored, logo-bearing template distinct
// from these internal reports' plain black-and-white "accounting" style.
/**
 * Generate a Fleet Trailer Report PDF (the trailer list)
 *
 * Trailers carry no revenue and no expenses in this data model — they attach
 * to a truck, not to trips — so unlike the truck report this is purely a
 * registration, licensing and assignment summary.
 */
export function generateTrailerReportPDF(data: {
  trailers: Array<{
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    type: string;
    status: string;
    licenseNumber: string;
    licenseExpiration: string;
    assignedTruck: string;
  }>;
  analytics: {
    totalTrailers: number;
    activeTrailers: number;
    assignedTrailers: number;
    expiringLicenses: number;
  };
  period: { startDate: Date | string; endDate: Date | string };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Fleet Trailer Report",
    subtitle: "Trailer Inventory, Licensing & Assignment",
    reportType: "trailer-report",
    period: data.period,
    summary: [
      { label: "Total Trailers", value: data.analytics.totalTrailers, format: "number" },
      { label: "Active Trailers", value: data.analytics.activeTrailers, format: "number" },
      { label: "Assigned to a Truck", value: data.analytics.assignedTrailers, format: "number" },
      { label: "Licences Expiring Soon", value: data.analytics.expiringLicenses, format: "number" },
    ],
    sections: [
      {
        title: "Trailer Details",
        columns: [
          { header: "Reg. No.", key: "registrationNo", align: "left" },
          { header: "Make/Model", key: "makeModel", align: "left" },
          { header: "Year", key: "year", align: "center" },
          { header: "Type", key: "type", align: "left" },
          { header: "Status", key: "status", align: "center" },
          { header: "Licence No.", key: "licenseNumber", align: "left" },
          { header: "Licence Expires", key: "licenseExpiration", align: "center" },
          { header: "Assigned Truck", key: "assignedTruck", align: "left" },
        ],
        data: data.trailers.map((t) => ({
          registrationNo: t.registrationNo,
          makeModel: `${t.make} ${t.model}`,
          year: t.year,
          type: t.type,
          status: t.status.replace(/_/g, " "),
          licenseNumber: t.licenseNumber,
          licenseExpiration: t.licenseExpiration,
          assignedTruck: t.assignedTruck,
        })),
      },
    ],
    notes: [
      "Trailers are assigned to trucks, not to drivers.",
      "Revenue and expenses are tracked against the towing truck and the trip, not the trailer.",
      "\"Licences Expiring Soon\" counts licences that expire within 30 days of the report date.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Single Trailer Report PDF (for an individual trailer's page)
 */
export function generateSingleTrailerReportPDF(data: {
  trailer: {
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    type: string;
    status: string;
    licenseNumber: string;
    licenseExpiration: string;
    assignedTruck: string;
    notes: string;
  };
}): Uint8Array {
  const config: ReportConfig = {
    title: "Trailer Report",
    subtitle: `${data.trailer.make} ${data.trailer.model} (${data.trailer.registrationNo})`,
    reportType: "single-trailer-report",
    period: {
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date(),
    },
    summary: [
      { label: "Status", value: data.trailer.status, format: "text" },
      { label: "Type", value: data.trailer.type, format: "text" },
      { label: "Assigned Truck", value: data.trailer.assignedTruck, format: "text" },
    ],
    sections: [
      {
        title: "Trailer Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Registration No.", value: data.trailer.registrationNo },
          { field: "Make", value: data.trailer.make },
          { field: "Model", value: data.trailer.model },
          { field: "Year", value: data.trailer.year },
          { field: "Type", value: data.trailer.type },
          { field: "Status", value: data.trailer.status },
          { field: "Licence Number", value: data.trailer.licenseNumber },
          { field: "Licence Expiration", value: data.trailer.licenseExpiration },
          { field: "Assigned Truck", value: data.trailer.assignedTruck },
        ],
      },
    ],
    notes: data.trailer.notes
      ? ["Trailer Notes:", data.trailer.notes]
      : ["This report contains trailer information as of the report date."],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}

/**
 * Generate a Single Customer Report PDF (for an individual customer's page).
 *
 * The PDF counterpart of generateCustomerDetailReportWord — the detail page
 * previously offered no export at all, and the list page's row menu only ever
 * offered Word.
 */
export function generateSingleCustomerReportPDF(data: {
  customer: {
    name: string;
    email: string;
    phone: string;
    address: string;
    status: string;
    balance: number;
  };
  summary: {
    totalTrips: number;
    totalInvoiced: number;
    totalPaid: number;
    totalOwed: number;
  };
  trips: Array<{
    tripNumber: string;
    route: string;
    date: string;
    status: string;
    fare: number;
  }>;
  invoices: Array<{
    invoiceNumber: string;
    issueDate: string;
    dueDate: string;
    status: string;
    total: number;
    balance: number;
  }>;
  payments: Array<{
    paymentDate: string;
    invoiceNumber: string;
    method: string;
    reference: string;
    amount: number;
  }>;
}): Uint8Array {
  const config: ReportConfig = {
    title: "Customer Report",
    subtitle: data.customer.name,
    reportType: "single-customer-report",
    period: {
      startDate: new Date(new Date().setMonth(new Date().getMonth() - 1)),
      endDate: new Date(),
    },
    summary: [
      { label: "Total Trips", value: data.summary.totalTrips, format: "number" },
      { label: "Total Invoiced", value: data.summary.totalInvoiced, format: "currency" },
      { label: "Total Paid", value: data.summary.totalPaid, format: "currency" },
      { label: "Outstanding", value: data.summary.totalOwed, format: "currency" },
    ],
    sections: [
      {
        title: "Customer Information",
        columns: [
          { header: "Field", key: "field", align: "left" },
          { header: "Value", key: "value", align: "left" },
        ],
        data: [
          { field: "Name", value: data.customer.name },
          { field: "Email", value: data.customer.email },
          { field: "Phone", value: data.customer.phone },
          { field: "Address", value: data.customer.address },
          { field: "Status", value: data.customer.status },
        ],
      },
      ...(data.trips.length > 0
        ? [
            {
              title: "Trips",
              columns: [
                { header: "Trip #", key: "tripNumber", align: "left" as const },
                { header: "Route", key: "route", align: "left" as const },
                { header: "Date", key: "date", align: "center" as const },
                { header: "Status", key: "status", align: "center" as const },
                { header: "Fare", key: "fare", format: "currency" as const, align: "right" as const },
              ],
              data: data.trips as unknown as Record<string, unknown>[],
              showTotal: true,
              totalLabel: "Total Fares",
              totalColumns: ["fare"],
            },
          ]
        : []),
      ...(data.invoices.length > 0
        ? [
            {
              title: "Invoices",
              columns: [
                { header: "Invoice #", key: "invoiceNumber", align: "left" as const },
                { header: "Issued", key: "issueDate", align: "center" as const },
                { header: "Due", key: "dueDate", align: "center" as const },
                { header: "Status", key: "status", align: "center" as const },
                { header: "Total", key: "total", format: "currency" as const, align: "right" as const },
                { header: "Balance", key: "balance", format: "currency" as const, align: "right" as const },
              ],
              data: data.invoices as unknown as Record<string, unknown>[],
              showTotal: true,
              totalLabel: "Totals",
              totalColumns: ["total", "balance"],
            },
          ]
        : []),
      ...(data.payments.length > 0
        ? [
            {
              title: "Payments",
              columns: [
                { header: "Date", key: "paymentDate", align: "center" as const },
                { header: "Invoice #", key: "invoiceNumber", align: "left" as const },
                { header: "Method", key: "method", align: "left" as const },
                { header: "Reference", key: "reference", align: "left" as const },
                { header: "Amount", key: "amount", format: "currency" as const, align: "right" as const },
              ],
              data: data.payments as unknown as Record<string, unknown>[],
              showTotal: true,
              totalLabel: "Total Paid",
              totalColumns: ["amount"],
            },
          ]
        : []),
    ],
    notes: [
      "A negative balance means the customer owes money to the company.",
      "Figures reflect the customer's full history, not a single reporting period.",
    ],
  };

  const generator = new PDFReportGenerator(config);
  return generator.generate();
}
