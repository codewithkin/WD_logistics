/**
 * CSV for the four money reports.
 *
 * Each mirrors the sections of its PDF, so a reader who exports both gets the
 * same tables in the same order. Figures go out unformatted (no currency
 * symbol, no thousands separators) because a spreadsheet needs to sum them.
 */

import { buildReportCSV, type CsvReportOptions } from "@/lib/reports/csv-sections";
import { AGEING_BUCKETS } from "@/lib/reports/finance-fetchers";
import type {
  AgedReceivablesData,
  CashFlowData,
  CreditorsData,
  ProfitAndLossData,
} from "@/lib/reports/finance-fetchers";

const n = (value: number) => value.toFixed(2);
const day = (value: Date | null | undefined) =>
  value ? value.toISOString().split("T")[0] : "";

export function generateProfitAndLossCSV(
  data: ProfitAndLossData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Profit & Loss" }, [
    {
      title: "Summary",
      headers: ["Measure", "Amount"],
      rows: [
        ["Revenue earned", n(data.revenue)],
        ["Total expenses", n(data.expenses)],
        ["Net profit", n(data.profit)],
        ["Margin %", n(data.margin)],
        ["Completed trips", data.tripCount],
        ...(data.previous
          ? [
              ["Previous period revenue", n(data.previous.revenue)],
              ["Previous period expenses", n(data.previous.expenses)],
              ["Previous period profit", n(data.previous.profit)],
            ]
          : []),
      ],
    },
    {
      title: "Month by month",
      headers: ["Month", "Revenue", "Expenses", "Profit"],
      rows: data.monthly.map((r) => [r.month, n(r.revenue), n(r.expenses), n(r.profit)]),
      total: ["Total", n(data.revenue), n(data.expenses), n(data.profit)],
      emptyMessage: "No activity in this period",
    },
    {
      title: "Revenue by customer",
      headers: ["Customer", "Trips", "Revenue", "Share %"],
      rows: data.revenueByCustomer.map((r) => [
        r.customer,
        r.trips,
        n(r.revenue),
        n(r.share),
      ]),
      total: ["Total", data.tripCount, n(data.revenue), "100.00"],
      emptyMessage: "No completed trips in this period",
    },
    {
      title: "Expenses by category",
      headers: ["Category", "Type", "Entries", "Amount", "Share %"],
      rows: data.expensesByCategory.map((r) => [
        r.category,
        r.kind,
        r.count,
        n(r.amount),
        n(r.share),
      ]),
      total: [
        "Total",
        "",
        data.expensesByCategory.reduce((s, r) => s + r.count, 0),
        n(data.expenses),
        "100.00",
      ],
      emptyMessage: "No expenses recorded in this period",
    },
  ]);
}

export function generateAgedReceivablesCSV(
  data: AgedReceivablesData,
  options: Omit<CsvReportOptions, "title">,
): string {
  const bucketHeaders = AGEING_BUCKETS.map((b) => b.label);

  return buildReportCSV({ ...options, title: "Aged Receivables" }, [
    {
      title: "By customer",
      headers: ["Customer", "Phone", "Invoices", ...bucketHeaders, "Total"],
      rows: data.rows.map((r) => [
        r.customer,
        r.phone ?? "",
        r.invoices,
        n(r.buckets.current),
        n(r.buckets.d30),
        n(r.buckets.d60),
        n(r.buckets.d90),
        n(r.buckets.d90plus),
        n(r.total),
      ]),
      total: [
        "Total",
        "",
        data.rows.reduce((s, r) => s + r.invoices, 0),
        n(data.totals.current),
        n(data.totals.d30),
        n(data.totals.d60),
        n(data.totals.d90),
        n(data.totals.d90plus),
        n(data.total),
      ],
      emptyMessage: "Nothing outstanding",
    },
    {
      title: "Invoice detail",
      headers: [
        "Customer",
        "Invoice",
        "Issued",
        "Due",
        "Days overdue",
        "Invoiced",
        "Paid",
        "Balance",
        "Bucket",
      ],
      rows: data.detail.map((r) => [
        r.customer,
        r.invoiceNumber,
        day(r.issueDate),
        day(r.dueDate),
        r.daysOverdue,
        n(r.total),
        n(r.paid),
        n(r.balance),
        r.bucket,
      ]),
      emptyMessage: "No outstanding invoices",
    },
  ]);
}

export function generateCreditorsCSV(
  data: CreditorsData,
  options: Omit<CsvReportOptions, "title">,
): string {
  const bucketHeaders = AGEING_BUCKETS.map((b) => b.label);

  return buildReportCSV({ ...options, title: "Creditors" }, [
    {
      title: "By supplier",
      headers: [
        "Supplier",
        "Terms (days)",
        "Unpaid entries",
        "Ledger balance",
        ...bucketHeaders,
        "Total",
      ],
      rows: data.rows.map((r) => [
        r.supplier,
        r.terms,
        r.unpaidCount,
        n(r.ledgerBalance),
        n(r.buckets.current),
        n(r.buckets.d30),
        n(r.buckets.d60),
        n(r.buckets.d90),
        n(r.buckets.d90plus),
        n(r.total),
      ]),
      total: [
        "Total",
        "",
        data.rows.reduce((s, r) => s + r.unpaidCount, 0),
        n(data.rows.reduce((s, r) => s + r.ledgerBalance, 0)),
        n(data.totals.current),
        n(data.totals.d30),
        n(data.totals.d60),
        n(data.totals.d90),
        n(data.totals.d90plus),
        n(data.total),
      ],
      emptyMessage: "Nothing owed to suppliers",
    },
    {
      title: "Unpaid with no supplier recorded",
      headers: ["Date", "Category", "Note", "Amount"],
      rows: data.unattached.map((r) => [
        day(r.date),
        r.category,
        r.notes,
        n(r.amount),
      ]),
      total: ["Total", "", "", n(data.unattachedTotal)],
      emptyMessage: "None",
    },
  ]);
}

export function generateCashFlowCSV(
  data: CashFlowData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Cash Flow" }, [
    {
      title: "Month by month",
      headers: [
        "Month",
        "From customers",
        "To suppliers",
        "Other spend",
        "Net",
      ],
      rows: data.monthly.map((r) => [
        r.month,
        n(r.customerReceipts),
        n(r.supplierPayments),
        n(r.otherSpend),
        n(r.net),
      ]),
      total: [
        "Total",
        n(data.cashIn),
        n(data.monthly.reduce((s, m) => s + m.supplierPayments, 0)),
        n(data.monthly.reduce((s, m) => s + m.otherSpend, 0)),
        n(data.net),
      ],
      emptyMessage: "No cash movement in this period",
    },
    {
      title: "By account",
      headers: ["Account", "Type", "Opening", "In", "Out", "Closing"],
      rows: data.accounts.map((r) => [
        r.name,
        r.type,
        n(r.opening),
        n(r.paidIn),
        n(r.paidOut),
        n(r.closing),
      ]),
      total: [
        "Total",
        "",
        n(data.accounts.reduce((s, a) => s + a.opening, 0)),
        n(data.accounts.reduce((s, a) => s + a.paidIn, 0)),
        n(data.accounts.reduce((s, a) => s + a.paidOut, 0)),
        n(data.accounts.reduce((s, a) => s + a.closing, 0)),
      ],
      emptyMessage: "No accounts configured",
    },
    {
      title: "Where the money went",
      headers: ["Category", "Amount", "Share %"],
      rows: data.outflowByCategory.map((r) => [r.category, n(r.amount), n(r.share)]),
      emptyMessage: "No spending recorded in this period",
    },
  ]);
}
