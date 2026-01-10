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
  trip: string;
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

export interface ReportMeta {
  startDate: string;
  endDate: string;
  period: string;
  generatedAt?: Date;
  customerName?: string;
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
  const metaInfo = [
    `"WD Logistics - Profit Per Unit Report"`,
    `"Period: ${meta.startDate} - ${meta.endDate}"`,
    `"Generated: ${new Date().toISOString()}"`,
    `""`,
  ].join("\n");

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

  return `${metaInfo}\n${csvData}\n${totalsRow}`;
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

  const metaInfo = [
    `"WD Logistics - Revenue Report"`,
    `"Period: ${meta.startDate} - ${meta.endDate}"`,
    `"Generated: ${new Date().toISOString()}"`,
    `""`,
  ].join("\n");

  const csvData = generateCSV(data, { columns });

  const totalsRow = [`"TOTAL"`, `""`, `""`, `""`, `"${formatCurrency(total)}"`].join(",");

  return `${metaInfo}\n${csvData}\n${totalsRow}`;
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
    { key: "trip", label: "Trip" },
    { key: "amount", label: "Amount ($)", format: (v) => formatCurrency(v as number) },
  ];

  const metaInfo = [
    `"WD Logistics - Expense Report"`,
    `"Period: ${meta.startDate} - ${meta.endDate}"`,
    `"Generated: ${new Date().toISOString()}"`,
    `""`,
  ].join("\n");

  const csvData = generateCSV(data, { columns });

  const totalsRow = [`"TOTAL"`, `""`, `""`, `""`, `""`, `"${formatCurrency(total)}"`].join(",");

  return `${metaInfo}\n${csvData}\n${totalsRow}`;
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

  const metaInfo = [
    `"WD Logistics - Customer Statement"`,
    `"Customer: ${meta.customerName || "N/A"}"`,
    `"Period: ${meta.startDate} - ${meta.endDate}"`,
    `"Generated: ${new Date().toISOString()}"`,
    `""`,
    `"Opening Balance: $${formatCurrency(openingBalance)}"`,
    `""`,
  ].join("\n");

  const csvData = generateCSV(data, { columns });

  const closingRow = [`""`, `""`, `""`, `"CLOSING BALANCE"`, `""`, `""`, `"${formatCurrency(closingBalance)}"`].join(",");

  return `${metaInfo}\n${csvData}\n${closingRow}`;
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

  const metaInfo = [
    `"WD Logistics - Trip Summary Report"`,
    `"Period: ${meta.startDate} - ${meta.endDate}"`,
    `"Generated: ${new Date().toISOString()}"`,
    `""`,
  ].join("\n");

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

  return `${metaInfo}\n${csvData}\n${totalsRow}`;
}
