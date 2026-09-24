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
  requiresTrailer?: boolean;
  requiresTrip?: boolean;
}

export const reportConfigs: Record<string, ReportConfig> = {
  "fuel-report": {
    id: "fuel-report",
    name: "Fuel Report",
    description:
      "Fuel spend and cost per kilometre for every truck, ranked heaviest first and compared against the fleet average.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "registrationNo", label: "Truck", type: "string" },
      { key: "kilometres", label: "Distance", type: "number" },
      { key: "fuelSpend", label: "Fuel", type: "currency" },
      { key: "fuelPerKm", label: "Per km", type: "currency" },
      { key: "fuelShareOfRevenue", label: "% of revenue", type: "percentage" },
    ],
  },
  "maintenance-downtime": {
    id: "maintenance-downtime",
    name: "Maintenance & Downtime",
    description:
      "Workshop jobs raised, fixed and still open per vehicle, with days off the road and what the workshop cost.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "vehicle", label: "Vehicle", type: "string" },
      { key: "raised", label: "Raised", type: "number" },
      { key: "fixed", label: "Fixed", type: "number" },
      { key: "stillOpen", label: "Open", type: "number" },
      { key: "downtimeDays", label: "Downtime (days)", type: "number" },
      { key: "maintenanceSpend", label: "Spend", type: "currency" },
    ],
  },
  "driver-performance": {
    id: "driver-performance",
    name: "Driver Performance",
    description:
      "Trips, distance, revenue and driver costs for every driver with activity in the period.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "driver", label: "Driver", type: "string" },
      { key: "trips", label: "Trips", type: "number" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "expenses", label: "Driver costs", type: "currency" },
      { key: "profit", label: "Profit", type: "currency" },
      { key: "margin", label: "Margin %", type: "percentage" },
    ],
  },
  "profit-loss": {
    id: "profit-loss",
    name: "Profit & Loss Statement",
    description:
      "Revenue, expenses and profit for the period — month by month, by customer and by expense category, against the period before it.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "month", label: "Month", type: "string" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "expenses", label: "Expenses", type: "currency" },
      { key: "profit", label: "Profit", type: "currency" },
      { key: "margin", label: "Margin %", type: "percentage" },
    ],
  },
  "aged-receivables": {
    id: "aged-receivables",
    name: "Aged Receivables (Debtors)",
    description:
      "Who owes money and for how long — current, 1-30, 31-60, 61-90 and 90+ days, per customer, with the invoices behind it.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "customer", label: "Customer", type: "string" },
      { key: "invoices", label: "Invoices", type: "number" },
      { key: "current", label: "Current", type: "currency" },
      { key: "d30", label: "1-30 days", type: "currency" },
      { key: "d60", label: "31-60 days", type: "currency" },
      { key: "d90", label: "61-90 days", type: "currency" },
      { key: "d90plus", label: "90+ days", type: "currency" },
      { key: "total", label: "Total owed", type: "currency" },
    ],
  },
  creditors: {
    id: "creditors",
    name: "Creditors (Supplier Payables)",
    description:
      "What the company owes and to whom, aged by each supplier's payment terms, including unpaid entries with no supplier recorded.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "supplier", label: "Supplier", type: "string" },
      { key: "terms", label: "Terms", type: "number" },
      { key: "unpaidCount", label: "Unpaid", type: "number" },
      { key: "total", label: "Total owed", type: "currency" },
    ],
  },
  "cash-flow": {
    id: "cash-flow",
    name: "Cash Flow Statement",
    description:
      "Money actually received and actually paid out, month by month, with each account's opening and closing position.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "month", label: "Month", type: "string" },
      { key: "customerReceipts", label: "From customers", type: "currency" },
      { key: "supplierPayments", label: "To suppliers", type: "currency" },
      { key: "otherSpend", label: "Other spend", type: "currency" },
      { key: "net", label: "Net", type: "currency" },
    ],
  },
  "truck-cost-breakdown": {
    id: "truck-cost-breakdown",
    name: "Truck Cost Breakdown",
    description:
      "Where each truck's money goes — by category, with fuel per km and workshop downtime, against the fleet average. Leave the truck blank for the whole fleet.",
    periods: ["monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "registrationNo", label: "Truck", type: "string" },
      { key: "revenue", label: "Revenue", type: "currency" },
      { key: "expenses", label: "Costs", type: "currency" },
      { key: "profit", label: "Profit", type: "currency" },
      { key: "margin", label: "Margin %", type: "percentage" },
      { key: "costPerKm", label: "Cost/km", type: "currency" },
      { key: "worstCategory", label: "Worst category", type: "string" },
    ],
  },
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
  // Expenses-only counterparts to the combined revenue-vs-expenses reports
  // above. truck-profitability and trip-summary both mix in revenue; these
  // answer "what did this unit cost me" on its own. Trailers only ever get
  // this variant — they carry no revenue in the data model.
  "truck-expenses": {
    id: "truck-expenses",
    name: "Truck Expenses (Expenses Only)",
    description: "Every expense recorded against a single truck, with no revenue side",
    periods: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    requiresTruck: true,
  },
  "trailer-expenses": {
    id: "trailer-expenses",
    name: "Trailer Expenses (Expenses Only)",
    description: "Every expense recorded against a single trailer",
    periods: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    requiresTrailer: true,
  },
  "trip-expenses": {
    id: "trip-expenses",
    name: "Trip Expenses (Expenses Only)",
    description: "Every expense recorded against a single trip, with no revenue side",
    periods: ["daily", "weekly", "monthly", "quarterly", "yearly", "custom"],
    formats: ["pdf", "csv"],
    fields: [
      { key: "date", label: "Date", type: "date" },
      { key: "category", label: "Category", type: "string" },
      { key: "description", label: "Description", type: "string" },
      { key: "amount", label: "Amount", type: "currency" },
    ],
    requiresTrip: true,
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
