import { prisma } from "@/lib/prisma";
import type { FinancialReportData, FinancialReportTemplateProps } from "./financial-report-template";

/**
 * Fetch revenue data for financial report
 */
export async function fetchRevenueFinancialData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<FinancialReportData> {
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      issueDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      customer: true,
    },
    orderBy: { issueDate: "desc" },
  });

  const items = invoices.map((inv) => ({
    description: `${inv.customer.name}`,
    amount: inv.total,
    reference: inv.invoiceNumber,
    date: inv.issueDate,
    category: "Revenue",
  }));

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    items,
    summary: {
      subtotal: total,
      total,
    },
  };
}

/**
 * Fetch expense data for financial report
 */
export async function fetchExpenseFinancialData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<FinancialReportData> {
  const expenses = await prisma.expense.findMany({
    where: {
      organizationId,
      date: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      category: true,
    },
    orderBy: { date: "desc" },
  });

  const items = expenses.map((exp) => ({
    description: exp.description,
    amount: exp.amount,
    reference: exp.id.slice(0, 8).toUpperCase(),
    date: exp.date,
    category: exp.category?.name || "Other",
  }));

  const total = items.reduce((sum, item) => sum + item.amount, 0);

  return {
    items,
    summary: {
      subtotal: total,
      total,
    },
  };
}

/**
 * Fetch profit data (revenue - expenses) for financial report
 */
export async function fetchProfitFinancialData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<FinancialReportData> {
  const [revenueData, expenseData] = await Promise.all([
    fetchRevenueFinancialData(organizationId, startDate, endDate),
    fetchExpenseFinancialData(organizationId, startDate, endDate),
  ]);

  const revenue = revenueData.summary?.total || 0;
  const expenses = expenseData.summary?.total || 0;
  const profit = revenue - expenses;

  return {
    items: [
      {
        description: "Total Revenue",
        amount: revenue,
        category: "Income",
      },
      {
        description: "Total Expenses",
        amount: -expenses,
        category: "Expenses",
      },
    ],
    summary: {
      subtotal: revenue,
      discount: expenses,
      total: profit,
    },
  };
}

/**
 * Fetch comprehensive financial summary
 */
export async function fetchFinancialSummaryData(
  organizationId: string,
  startDate: Date,
  endDate: Date
): Promise<FinancialReportData> {
  const [
    revenueData,
    expenseData,
    payments,
  ] = await Promise.all([
    fetchRevenueFinancialData(organizationId, startDate, endDate),
    fetchExpenseFinancialData(organizationId, startDate, endDate),
    prisma.payment.findMany({
      where: {
        invoice: { organizationId },
        paymentDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        invoice: true,
      },
    }),
  ]);

  const paymentItems = payments.map((pmt) => ({
    description: `Payment - ${pmt.invoice.invoiceNumber}`,
    amount: pmt.amount,
    reference: pmt.id.slice(0, 8).toUpperCase(),
    date: pmt.paymentDate,
    category: "Collections",
  }));

  const allItems = [
    ...revenueData.items,
    ...expenseData.items,
    ...paymentItems,
  ];

  const revenue = revenueData.summary?.total || 0;
  const expenses = expenseData.summary?.total || 0;
  const collections = paymentItems.reduce((sum, item) => sum + item.amount, 0);
  const profit = revenue - expenses;

  return {
    items: allItems,
    summary: {
      subtotal: revenue,
      discount: expenses,
      total: profit,
    },
  };
}

/**
 * Generate financial report template properties based on report type
 */
export async function generateFinancialReportProps(
  reportType: "revenue" | "expenses" | "profit" | "summary",
  organizationId: string,
  startDate: Date,
  endDate: Date,
  companyName: string = "WD Logistics"
): Promise<FinancialReportTemplateProps> {
  let data: FinancialReportData;
  let title: string;

  switch (reportType) {
    case "revenue":
      data = await fetchRevenueFinancialData(organizationId, startDate, endDate);
      title = "Revenue Report";
      break;
    case "expenses":
      data = await fetchExpenseFinancialData(organizationId, startDate, endDate);
      title = "Expense Report";
      break;
    case "profit":
      data = await fetchProfitFinancialData(organizationId, startDate, endDate);
      title = "Profit & Loss Report";
      break;
    case "summary":
      data = await fetchFinancialSummaryData(organizationId, startDate, endDate);
      title = "Financial Summary Report";
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

export default FinancialReportTemplate;

/**
 * Generate CSV content for financial report
 */
export async function generateFinancialReportCSV(
  reportType: "revenue" | "expenses" | "profit" | "summary",
  organizationId: string,
  startDate: Date,
  endDate: Date,
  companyName: string = "WD Logistics"
): Promise<string> {
  let data: FinancialReportData;
  let title: string;

  switch (reportType) {
    case "revenue":
      data = await fetchRevenueFinancialData(organizationId, startDate, endDate);
      title = "Revenue Report";
      break;
    case "expenses":
      data = await fetchExpenseFinancialData(organizationId, startDate, endDate);
      title = "Expense Report";
      break;
    case "profit":
      data = await fetchProfitFinancialData(organizationId, startDate, endDate);
      title = "Profit & Loss Report";
      break;
    case "summary":
      data = await fetchFinancialSummaryData(organizationId, startDate, endDate);
      title = "Financial Summary Report";
      break;
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }

  const rows: string[] = [];

  // Header
  rows.push(`${companyName}`);
  rows.push(`${title}`);
  rows.push(`Period: ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}`);
  rows.push(""); // Blank line

  // Column headers
  const hasReference = data.items.some((item) => item.reference);
  const hasDate = data.items.some((item) => item.date);
  const hasCategory = data.items.some((item) => item.category);

  const headers = ["Description"];
  if (hasCategory) headers.push("Category");
  if (hasReference) headers.push("Reference");
  if (hasDate) headers.push("Date");
  headers.push("Amount");

  rows.push(headers.join(","));

  // Data rows
  data.items.forEach((item) => {
    const cells = [
      `"${item.description.replace(/"/g, '""')}"`,
    ];
    if (hasCategory) cells.push(`"${item.category || ""}"`);
    if (hasReference) cells.push(`"${item.reference || ""}"`);
    if (hasDate) cells.push(item.date ? `"${formatDate(item.date)}"` : "");
    cells.push(item.amount.toFixed(2));
    rows.push(cells.join(","));
  });

  // Totals
  rows.push(""); // Blank line
  const totalCells = ["TOTAL"];
  if (hasCategory) totalCells.push("");
  if (hasReference) totalCells.push("");
  if (hasDate) totalCells.push("");
  totalCells.push((data.summary?.total || 0).toFixed(2));
  rows.push(totalCells.join(","));

  rows.push(""); // Blank line
  rows.push(`Generated: ${new Date().toISOString()}`);

  return rows.join("\n");
}

// Helper function for consistent date formatting
function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}
