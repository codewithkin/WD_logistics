// Report Configuration Types and Definitions

export type ReportPeriod = "daily" | "weekly" | "monthly" | "quarterly" | "yearly" | "custom";
export type ReportFormat = "pdf" | "csv";

export interface ReportField {
  key: string;
  label: string;
  type: "string" | "number" | "currency" | "percentage" | "date";
}

export interface ReportConfig {
  id: string;
  name: string;
  description: string;
  periods: ReportPeriod[];
  formats: ReportFormat[];
  fields: ReportField[];
  requiresCustomer?: boolean;
  requiresTruck?: boolean;
}

export const reportConfigs: Record<string, ReportConfig> = {
  "profit-per-unit": {
    id: "profit-per-unit",
    name: "Profit Per Unit Report",
    description: "Detailed breakdown of revenue, expenses, and profit for each truck",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "registrationNo", label: "Truck", type: "string" },
      { key: "make", label: "Make", type: "string" },
      { key: "model", label: "Model", type: "string" },
      { key: "trips", label: "Trips", type: "number" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "expenses", label: "Expenses", type: "currency" },
      { key: "profit", label: "Profit", type: "currency" },
      { key: "profitMargin", label: "Margin %", type: "percentage" },
    ],
  },
  revenue: {
    id: "revenue",
    name: "Revenue Report",
    description: "Summary of all revenue by customer and trip",
    periods: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "customer", label: "Customer", type: "string" },
      { key: "invoiceNo", label: "Invoice #", type: "string" },
      { key: "trip", label: "Trip", type: "string" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
  },
  expenses: {
    id: "expenses",
    name: "Expense Report",
    description: "Comprehensive expense breakdown by category and truck",
    periods: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "truck", label: "Truck", type: "string" },
      { key: "trip", label: "Trip", type: "string" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
  },
  "customer-statement": {
    id: "customer-statement",
    name: "Customer Statement",
    description: "Statement of account for a specific customer",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "type", label: "Type", type: "string" },
      { key: "reference", label: "Reference", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "debit", label: "Debit", type: "currency" },
      { key: "credit", label: "Credit", type: "currency" },
      { key: "balance", label: "Balance", type: "currency" },
    ],
    requiresCustomer: true,
  },
  "trip-summary": {
    id: "trip-summary",
    name: "Trip Summary Report",
    description: "Summary of all trips with revenue and expenses",
    periods: ["weekly", "monthly", "quarterly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "tripNumber", label: "Trip #", type: "string" },
      { key: "date", label: "Date", type: "date" },
      { key: "origin", label: "Origin", type: "string" },
      { key: "destination", label: "Destination", type: "string" },
      { key: "truck", label: "Truck", type: "string" },
      { key: "driver", label: "Driver", type: "string" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "expenses", label: "Expenses", type: "currency" },
      { key: "profit", label: "Profit", type: "currency" },
    ],
  },
  "account-ledger": {
    id: "account-ledger",
    name: "Account Ledger Report",
    description: "Cash / Bank / Petty Cash: opening balance, usage, and remaining for the period",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "accountName", label: "Account", type: "string" },
      { key: "openingBalance", label: "Opening Balance", type: "currency" },
      { key: "totalDebits", label: "Usage", type: "currency" },
      { key: "totalCredits", label: "Credits", type: "currency" },
      { key: "closingBalance", label: "Closing Balance", type: "currency" },
    ],
  },
  "truck-profitability": {
    id: "truck-profitability",
    name: "Truck Profitability Report",
    description: "Revenue vs. expenses (fuel, spares, maintenance, etc.) for a single truck",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "category", label: "Expense Category", type: "string" },
      { key: "amount", label: "Amount", type: "currency" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "profit", label: "Net Profit", type: "currency" },
      { key: "profitMargin", label: "Margin %", type: "percentage" },
    ],
    requiresTruck: true,
  },
};

export const reportTypeLabels: Record<string, string> = {
  profit_per_unit: "Profit Per Unit",
  revenue: "Revenue",
  expenses: "Expenses",
  customer_statement: "Customer Statement",
  trip_summary: "Trip Summary",
  truck_profitability: "Truck Profitability",
  account_ledger: "Account Ledger",
};

export const periodLabels: Record<ReportPeriod, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
  yearly: "Yearly",
  custom: "Custom",
};
