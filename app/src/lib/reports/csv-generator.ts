// CSV Generator for Reports

interface CSVColumn {
  key: string;
  label: string;
  format?: (value: unknown) => string;
}

interface CSVOptions {
  columns: CSVColumn[];
  includeHeaders?: boolean;
}

/**
 * Format a value for CSV output
 */
function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }
  if (typeof value === "string") {
    // Escape quotes and wrap in quotes
    return `"${value.replace(/"/g, '""')}"`;
  }
  if (typeof value === "number") {
    return value.toString();
  }
  return String(value);
}

/**
 * Format currency value
 */
export function formatCurrency(value: number): string {
  return value.toFixed(2);
}

/**
 * Format percentage value
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(2)}%`;
}

/**
 * Generate CSV from data array
 */
export function generateCSV<T>(
  data: T[],
  options: CSVOptions
): string {
  const { columns, includeHeaders = true } = options;

  const rows: string[] = [];

  // Add header row
  if (includeHeaders) {
    const headerRow = columns.map((col) => `"${col.label}"`).join(",");
    rows.push(headerRow);
  }

  // Add data rows
  for (const item of data) {
    const row = columns
      .map((col) => {
        const value = (item as Record<string, unknown>)[col.key];
        if (col.format) {
          return `"${col.format(value)}"`;
        }
        return formatValue(value);
      })
      .join(",");
    rows.push(row);
  }

  return rows.join("\n");
}

// Report-specific CSV generators

export interface ProfitPerUnitData {
  registrationNo: string;
  make: string;
  model: string;
  trips: number;
  revenue: number;
  expenses: number;
  profit: number;
  profitMargin: number;
}

export interface RevenueData {
  date: Date;
  customer: string;
  invoiceNo: string;
  trip: string;
  amount: number;
}

export interface ExpenseData {
  date: Date;
  category: string;
  description: string;
  truck: string;
  trailer: string;
  trip: string;
  vendor: string;
  reference: string;
  amount: number;
}

export interface CustomerStatementData {
  date: Date;
  type: "INVOICE" | "PAYMENT";
  reference: string;
  description: string;
  debit: number;
  credit: number;
  balance: number;
}

export interface TripSummaryData {
  tripNumber: string;
  date: Date;
  origin: string;
  destination: string;
  truck: string;
  driver: string;
  revenue: number;
  expenses: number;
  profit: number;
}

export interface AccountLedgerData {
  accountType: string;
  accountName: string;
  openingBalance: number;
  totalDebits: number;
  totalCredits: number;
  closingBalance: number;
  expenseBreakdown: Array<{ description: string; amount: number }>;
}

export interface TruckProfitabilityData {
  truck: { registrationNo: string; make: string; model: string };
  trips: number;
  revenue: number;
  expensesByCategory: Array<{ category: string; amount: number }>;
  totalExpenses: number;
  profit: number;
  profitMargin: number;
}

export interface ReportMeta {
  startDate: string;
  endDate: string;
  period: string;
  generatedAt?: Date;
  customerName?: string;
  /**
   * Whether to print the title/period/generated block above the columns.
   *
   * The Reports screen has always offered this as "clean import", and these
   * generators ignored it — they built the block unconditionally, so the
   * option did nothing for eight of the reports and the file still needed
   * hand-editing before a spreadsheet would read it.
   */
  includeMetadata?: boolean;
}

/** The title block, or nothing when the caller asked for a clean import. */
function metaBlock(title: string, meta: ReportMeta, extra: string[] = []): string {
  if (meta.includeMetadata === false) return "";
  return (
    [
      `"WD Logistics - ${title}"`,
      ...extra,
      `"Period: ${meta.startDate} - ${meta.endDate}"`,
      `"Generated: ${(meta.generatedAt ?? new Date()).toISOString()}"`,
      `""`,
    ].join("\n")
  );
}

/** Joins the parts of a CSV, skipping any that are empty. */
function csvDocument(...parts: string[]): string {
  return parts.filter((part) => part.length > 0).join("\n");
}

/**
 * Generate Profit Per Unit CSV
 */
export function generateProfitPerUnitCSV(
  data: ProfitPerUnitData[],
  meta: ReportMeta
): string {
  // Calculate totals
  const totals = data.reduce(
    (acc, item) => ({
      trips: acc.trips + item.trips,
      revenue: acc.revenue + item.revenue,
      expenses: acc.expenses + item.expenses,
      profit: acc.profit + item.profit,
    }),
    { trips: 0, revenue: 0, expenses: 0, profit: 0 }
  );

  const columns: CSVColumn[] = [
    { key: "registrationNo", label: "Truck Registration" },
    { key: "make", label: "Make" },
    { key: "model", label: "Model" },
    { key: "trips", label: "Number of Trips" },
    { key: "revenue", label: "Revenue ($)", format: (v) => formatCurrency(v as number) },
    { key: "expenses", label: "Expenses ($)", format: (v) => formatCurrency(v as number) },
    { key: "profit", label: "Profit ($)", format: (v) => formatCurrency(v as number) },
    { key: "profitMargin", label: "Profit Margin (%)", format: (v) => formatPercentage(v as number) },
  ];

  // Generate CSV with meta info
  const metaInfo = metaBlock("Profit Per Unit Report", meta);

  const csvData = generateCSV(data, { columns });

  // Add totals row
  const margin = totals.revenue > 0 ? (totals.profit / totals.revenue) * 100 : 0;
  const totalsRow = [
    `"TOTAL"`,
    `""`,
    `""`,
    `"${totals.trips}"`,
    `"${formatCurrency(totals.revenue)}"`,
    `"${formatCurrency(totals.expenses)}"`,
    `"${formatCurrency(totals.profit)}"`,
    `"${formatPercentage(margin)}"`,
  ].join(",");

  return csvDocument(metaInfo, csvData, totalsRow);
}

/**
 * Generate Revenue CSV
 */
export function generateRevenueCSV(data: RevenueData[], meta: ReportMeta): string {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  const columns: CSVColumn[] = [
    { key: "date", label: "Date", format: (v) => (v as Date).toISOString().split("T")[0] },
    { key: "customer", label: "Customer" },
    { key: "invoiceNo", label: "Invoice #" },
    { key: "trip", label: "Trip" },
    { key: "amount", label: "Amount ($)", format: (v) => formatCurrency(v as number) },
  ];

  const metaInfo = metaBlock("Revenue Report", meta);

  const csvData = generateCSV(data, { columns });

  const totalsRow = totalsRowFor(columns, { amount: formatCurrency(total) });

  return csvDocument(metaInfo, csvData, totalsRow);
}

/**
 * A totals row that lines up with its own columns.
 *
 * These were written out by hand, one quoted cell at a time, so a column
 * added later left the figures under the wrong heading — the expense report's
 * grand total was printing beneath "Trip" after the trailer column arrived.
 * Building the row from the column list makes that impossible.
 */
function totalsRowFor(
  columns: CSVColumn[],
  values: Record<string, string>,
  label = "TOTAL",
): string {
  return columns
    .map((column, index) => {
      if (index === 0) return `"${label}"`;
      const value = values[String(column.key)];
      return value === undefined ? `""` : `"${value}"`;
    })
    .join(",");
}

/**
 * Generate Expense CSV
 */
export function generateExpenseCSV(data: ExpenseData[], meta: ReportMeta): string {
  const total = data.reduce((sum, item) => sum + item.amount, 0);

  const columns: CSVColumn[] = [
    { key: "date", label: "Date", format: (v) => (v as Date).toISOString().split("T")[0] },
    { key: "category", label: "Category" },
    { key: "description", label: "Description" },
    { key: "truck", label: "Truck" },
    { key: "trailer", label: "Trailer" },
    { key: "trip", label: "Trip" },
    { key: "vendor", label: "Vendor" },
    { key: "reference", label: "Reference" },
    { key: "amount", label: "Amount ($)", format: (v) => formatCurrency(v as number) },
  ];

  const metaInfo = metaBlock("Expense Report", meta);

  const csvData = generateCSV(data, { columns });

  const totalsRow = totalsRowFor(columns, { amount: formatCurrency(total) });

  return csvDocument(metaInfo, csvData, totalsRow);
}

/**
 * Generate Customer Statement CSV
 */
export function generateCustomerStatementCSV(
  data: CustomerStatementData[],
  meta: ReportMeta,
  openingBalance: number,
  closingBalance: number
): string {
  const columns: CSVColumn[] = [
    { key: "date", label: "Date", format: (v) => (v as Date).toISOString().split("T")[0] },
    { key: "type", label: "Type" },
    { key: "reference", label: "Reference" },
    { key: "description", label: "Description" },
    { key: "debit", label: "Debit ($)", format: (v) => (v as number) > 0 ? formatCurrency(v as number) : "-" },
    { key: "credit", label: "Credit ($)", format: (v) => (v as number) > 0 ? formatCurrency(v as number) : "-" },
    { key: "balance", label: "Balance ($)", format: (v) => formatCurrency(v as number) },
  ];

  const metaInfo = metaBlock("Customer Statement", meta, [`"Customer: ${meta.customerName || "N/A"}"`, `"Opening Balance: $${formatCurrency(openingBalance)}"`]);

  const csvData = generateCSV(data, { columns });

  const closingRow = [`""`, `""`, `""`, `"CLOSING BALANCE"`, `""`, `""`, `"${formatCurrency(closingBalance)}"`].join(",");

  return csvDocument(metaInfo, csvData, closingRow);
}

/**
 * Generate Trip Summary CSV
 */
export function generateTripSummaryCSV(data: TripSummaryData[], meta: ReportMeta): string {
  const totals = data.reduce(
    (acc, item) => ({
      revenue: acc.revenue + item.revenue,
      expenses: acc.expenses + item.expenses,
      profit: acc.profit + item.profit,
    }),
    { revenue: 0, expenses: 0, profit: 0 }
  );

  const columns: CSVColumn[] = [
    { key: "tripNumber", label: "Trip #" },
    { key: "date", label: "Date", format: (v) => (v as Date).toISOString().split("T")[0] },
    { key: "origin", label: "Origin" },
    { key: "destination", label: "Destination" },
    { key: "truck", label: "Truck" },
    { key: "driver", label: "Driver" },
    { key: "revenue", label: "Revenue ($)", format: (v) => formatCurrency(v as number) },
    { key: "expenses", label: "Expenses ($)", format: (v) => formatCurrency(v as number) },
    { key: "profit", label: "Profit ($)", format: (v) => formatCurrency(v as number) },
  ];

  const metaInfo = metaBlock("Trip Summary Report", meta);

  const csvData = generateCSV(data, { columns });

  const totalsRow = [
    `"TOTAL"`,
    `""`,
    `""`,
    `""`,
    `""`,
    `""`,
    `"${formatCurrency(totals.revenue)}"`,
    `"${formatCurrency(totals.expenses)}"`,
    `"${formatCurrency(totals.profit)}"`,
  ].join(",");

  return csvDocument(metaInfo, csvData, totalsRow);
}

/**
 * Generate Account Ledger CSV (one section per account: opening balance,
 * total debits/credits, closing balance, and a spend breakdown)
 */
export function generateAccountLedgerCSV(data: AccountLedgerData[], meta: ReportMeta): string {
  const metaInfo = metaBlock("Account Ledger Report", meta);

  const sections = data.map((account) => {
    const header = [
      `"${account.accountName}"`,
      `""`,
    ].join(",");
    const summaryRows = [
      [`"Opening Balance"`, `"${formatCurrency(account.openingBalance)}"`].join(","),
      [`"Total Debits (usage)"`, `"${formatCurrency(account.totalDebits)}"`].join(","),
      [`"Total Credits"`, `"${formatCurrency(account.totalCredits)}"`].join(","),
      [`"Closing Balance"`, `"${formatCurrency(account.closingBalance)}"`].join(","),
      `""`,
    ].join("\n");

    const breakdownHeader = [`"Description"`, `"Amount ($)"`].join(",");
    const breakdownRows = account.expenseBreakdown
      .map((b) => [`"${b.description.replace(/"/g, '""')}"`, `"${formatCurrency(b.amount)}"`].join(","))
      .join("\n");

    return `${header}\n${summaryRows}\n${breakdownHeader}\n${breakdownRows}`;
  });

  return csvDocument(metaInfo, sections.join("\n\n"));
}

/**
 * Generate Truck Profitability CSV
 */
export function generateTruckProfitabilityCSV(
  data: TruckProfitabilityData,
  meta: ReportMeta
): string {
  const columns: CSVColumn[] = [
    { key: "category", label: "Expense Category" },
    { key: "amount", label: "Amount ($)", format: (v) => formatCurrency(v as number) },
  ];

  const metaInfo = metaBlock("Truck Profitability Report", meta, [`"Truck: ${data.truck.registrationNo} - ${data.truck.make} ${data.truck.model}"`, `"Trips Completed: ${data.trips}"`, `"Revenue: $${formatCurrency(data.revenue)}"`]);

  const csvData = generateCSV(data.expensesByCategory, { columns });

  const summaryRows = [
    [`"TOTAL EXPENSES"`, `"${formatCurrency(data.totalExpenses)}"`].join(","),
    [`""`, `""`].join(","),
    [`"NET PROFIT"`, `"${formatCurrency(data.profit)}"`].join(","),
    [`"PROFIT MARGIN"`, `"${formatPercentage(data.profitMargin)}"`].join(","),
  ].join("\n");

  return csvDocument(metaInfo, csvData, summaryRows);
}

/** One row per truck, matching the fleet table in the PDF. */
export interface TruckCostCSVRow {
  registrationNo: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
  kilometres: number;
  costPerKm: number | null;
  worstCategory: string;
}

export function generateTruckCostBreakdownCSV(
  data: TruckCostCSVRow[],
  meta: ReportMeta
): string {
  const columns: CSVColumn[] = [
    { key: "registrationNo", label: "Truck" },
    { key: "revenue", label: "Revenue ($)", format: (v) => formatCurrency(v as number) },
    { key: "expenses", label: "Costs ($)", format: (v) => formatCurrency(v as number) },
    { key: "profit", label: "Profit ($)", format: (v) => formatCurrency(v as number) },
    {
      key: "margin",
      label: "Margin (%)",
      format: (v) => (v === null ? "" : formatPercentage(v as number)),
    },
    { key: "kilometres", label: "Kilometres" },
    {
      key: "costPerKm",
      label: "Cost per km ($)",
      format: (v) => (v === null ? "" : formatCurrency(v as number)),
    },
    { key: "worstCategory", label: "Over-spends on" },
  ];

  // The allocation rule belongs with the numbers: a reader summing these in
  // a spreadsheet needs to know a shared cost was already split.
  const metaInfo = metaBlock("Truck Cost Breakdown", meta, [
    `"Shared costs are split evenly between the trucks they name."`,
  ]);

  return csvDocument(metaInfo, generateCSV(data, { columns }));
}
