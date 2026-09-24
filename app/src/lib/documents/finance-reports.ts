import "server-only";

/**
 * The four money reports, as documents.
 *
 * All four read figures that were computed in `lib/reports/finance-fetchers`
 * and do no arithmetic of their own beyond formatting — a document that
 * recalculates is a document that eventually disagrees with the screen.
 *
 * Each one leads with the number the reader came for, then shows the working.
 * An empty period renders a stated empty line rather than a blank table, so a
 * report is never ambiguous about whether it found nothing or broke.
 */

import {
  createDocument,
  dateRangeLabel,
  drawHeader,
  drawKpiRow,
  drawNotes,
  drawPeriodLine,
  drawSectionHeading,
  drawTable,
  drawTotals,
  finalise,
  money,
  shortDate,
  type OrganizationLike,
} from "@/lib/documents/kit";
import type {
  AgedReceivablesData,
  CashFlowData,
  CreditorsData,
  ProfitAndLossData,
} from "@/lib/reports/finance-fetchers";
import { AGEING_BUCKETS } from "@/lib/reports/finance-fetchers";

const pct = (value: number) => `${value.toFixed(1)}%`;

/** "+12.4% vs previous" — or a plain dash when there is nothing to compare. */
function movement(current: number, previous: number | undefined): string {
  if (previous === undefined || previous === 0) return "—";
  const change = ((current - previous) / Math.abs(previous)) * 100;
  return `${change >= 0 ? "+" : ""}${change.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------

export function generateProfitAndLossPDF(params: {
  organization: OrganizationLike | null;
  data: ProfitAndLossData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    title: "Profit and loss",
  });

  drawHeader(ctx, { title: "Profit & Loss", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Revenue earned", value: money(data.revenue) },
    { label: "Total expenses", value: money(data.expenses) },
    {
      label: "Net profit",
      value: money(data.profit),
      tone: data.profit >= 0 ? "green" : "danger",
    },
    { label: "Margin", value: pct(data.margin) },
  ]);

  if (data.previous) {
    drawKpiRow(ctx, [
      {
        label: "Revenue vs previous",
        value: movement(data.revenue, data.previous.revenue),
      },
      {
        label: "Expenses vs previous",
        value: movement(data.expenses, data.previous.expenses),
      },
      {
        label: "Profit vs previous",
        value: movement(data.profit, data.previous.profit),
        tone: data.profit >= data.previous.profit ? "green" : "danger",
      },
      { label: "Completed trips", value: String(data.tripCount) },
    ]);
  }

  drawSectionHeading(ctx, "Month by month");
  drawTable(
    ctx,
    [
      { header: "Month", key: "month" },
      { header: "Revenue", key: "revenue", align: "right" },
      { header: "Expenses", key: "expenses", align: "right" },
      { header: "Profit", key: "profit", align: "right" },
    ],
    data.monthly.map((row) => ({
      month: row.month,
      revenue: money(row.revenue),
      expenses: money(row.expenses),
      profit: money(row.profit),
    })),
    {
      foot: ["Total", money(data.revenue), money(data.expenses), money(data.profit)],
      emptyMessage: "No activity in this period.",
    },
  );

  drawSectionHeading(ctx, "Revenue by customer");
  drawTable(
    ctx,
    [
      { header: "Customer", key: "customer" },
      { header: "Trips", key: "trips", align: "right" },
      { header: "Revenue", key: "revenue", align: "right" },
      { header: "Share", key: "share", align: "right" },
    ],
    data.revenueByCustomer.map((row) => ({
      customer: row.customer,
      trips: row.trips,
      revenue: money(row.revenue),
      share: pct(row.share),
    })),
    {
      foot: ["Total", data.tripCount, money(data.revenue), "100.0%"],
      emptyMessage: "No completed trips in this period.",
    },
  );

  drawSectionHeading(ctx, "Expenses by category");
  drawTable(
    ctx,
    [
      { header: "Category", key: "category" },
      { header: "Type", key: "kind" },
      { header: "Entries", key: "count", align: "right" },
      { header: "Amount", key: "amount", align: "right" },
      { header: "Share", key: "share", align: "right" },
    ],
    data.expensesByCategory.map((row) => ({
      category: row.category,
      kind: row.kind,
      count: row.count,
      amount: money(row.amount),
      share: pct(row.share),
    })),
    {
      foot: [
        "Total",
        "",
        data.expensesByCategory.reduce((s, r) => s + r.count, 0),
        money(data.expenses),
        "100.0%",
      ],
      emptyMessage: "No expenses recorded in this period.",
    },
  );

  drawTotals(ctx, [
    { label: "Revenue earned", value: money(data.revenue) },
    { label: "Less expenses", value: money(-data.expenses) },
    { label: "Net profit", value: money(data.profit), emphasis: true },
  ]);

  drawNotes(
    ctx,
    "Basis",
    "Revenue counts completed trips only, dated by when the trip ended — not " +
      "when it was invoiced or paid. Expenses are counted on the date they " +
      "were incurred. A trip completed without an end date falls back to its " +
      "scheduled date so that it is never dropped from the total.",
  );

  return finalise(ctx, { note: "Profit & Loss" });
}

// ---------------------------------------------------------------------------

export function generateAgedReceivablesPDF(params: {
  organization: OrganizationLike | null;
  data: AgedReceivablesData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Aged receivables",
  });

  drawHeader(ctx, { title: "Aged Receivables", date: data.asOf });
  drawPeriodLine(ctx, `Outstanding as at ${shortDate(data.asOf)}`);

  const overdue =
    data.totals.d30 + data.totals.d60 + data.totals.d90 + data.totals.d90plus;

  drawKpiRow(ctx, [
    { label: "Total owed", value: money(data.total) },
    { label: "Not yet due", value: money(data.totals.current) },
    {
      label: "Overdue",
      value: money(overdue),
      tone: overdue > 0 ? "danger" : "green",
    },
    {
      label: "90+ days",
      value: money(data.totals.d90plus),
      tone: data.totals.d90plus > 0 ? "danger" : "green",
    },
  ]);

  drawSectionHeading(ctx, "By customer");
  drawTable(
    ctx,
    [
      { header: "Customer", key: "customer" },
      { header: "Invoices", key: "invoices", align: "right" },
      ...AGEING_BUCKETS.map((bucket) => ({
        header: bucket.label,
        key: bucket.key,
        align: "right" as const,
      })),
      { header: "Total", key: "total", align: "right" },
    ],
    data.rows.map((row) => ({
      customer: row.customer,
      invoices: row.invoices,
      current: money(row.buckets.current),
      d30: money(row.buckets.d30),
      d60: money(row.buckets.d60),
      d90: money(row.buckets.d90),
      d90plus: money(row.buckets.d90plus),
      total: money(row.total),
    })),
    {
      foot: [
        "Total",
        data.rows.reduce((s, r) => s + r.invoices, 0),
        money(data.totals.current),
        money(data.totals.d30),
        money(data.totals.d60),
        money(data.totals.d90),
        money(data.totals.d90plus),
        money(data.total),
      ],
      emptyMessage: "Nothing outstanding — every invoice is settled.",
    },
  );

  if (data.detail.length > 0) {
    drawSectionHeading(ctx, "Oldest invoices first");
    drawTable(
      ctx,
      [
        { header: "Customer", key: "customer" },
        { header: "Invoice", key: "invoiceNumber" },
        { header: "Issued", key: "issueDate" },
        { header: "Due", key: "dueDate" },
        { header: "Days over", key: "daysOverdue", align: "right" },
        { header: "Invoiced", key: "total", align: "right" },
        { header: "Paid", key: "paid", align: "right" },
        { header: "Balance", key: "balance", align: "right" },
      ],
      data.detail.map((row) => ({
        customer: row.customer,
        invoiceNumber: row.invoiceNumber,
        issueDate: shortDate(row.issueDate),
        dueDate: shortDate(row.dueDate),
        daysOverdue: row.daysOverdue > 0 ? row.daysOverdue : "—",
        total: money(row.total),
        paid: money(row.paid),
        balance: money(row.balance),
      })),
      { emptyMessage: "No outstanding invoices." },
    );
  }

  drawNotes(
    ctx,
    "How ageing is counted",
    "An invoice is 'current' until its due date passes; every other column " +
      "counts days past that due date, not days since it was raised. Draft " +
      "and cancelled invoices are excluded, and an invoice with no due date " +
      "is treated as current.",
  );

  return finalise(ctx, { note: "Aged Receivables" });
}

// ---------------------------------------------------------------------------

export function generateCreditorsPDF(params: {
  organization: OrganizationLike | null;
  data: CreditorsData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Creditors",
  });

  drawHeader(ctx, { title: "Creditors", date: data.asOf });
  drawPeriodLine(ctx, `Owed by the company as at ${shortDate(data.asOf)}`);

  const overdue =
    data.totals.d30 + data.totals.d60 + data.totals.d90 + data.totals.d90plus;

  drawKpiRow(ctx, [
    { label: "Total owed", value: money(data.total) },
    { label: "Not yet due", value: money(data.totals.current) },
    {
      label: "Overdue",
      value: money(overdue),
      tone: overdue > 0 ? "danger" : "green",
    },
    { label: "Unassigned", value: money(data.unattachedTotal) },
  ]);

  drawSectionHeading(ctx, "By supplier");
  drawTable(
    ctx,
    [
      { header: "Supplier", key: "supplier" },
      { header: "Terms", key: "terms", align: "right" },
      { header: "Unpaid", key: "unpaidCount", align: "right" },
      ...AGEING_BUCKETS.map((bucket) => ({
        header: bucket.label,
        key: bucket.key,
        align: "right" as const,
      })),
      { header: "Total", key: "total", align: "right" },
    ],
    data.rows.map((row) => ({
      supplier: row.supplier,
      terms: `${row.terms}d`,
      unpaidCount: row.unpaidCount,
      current: money(row.buckets.current),
      d30: money(row.buckets.d30),
      d60: money(row.buckets.d60),
      d90: money(row.buckets.d90),
      d90plus: money(row.buckets.d90plus),
      total: money(row.total),
    })),
    {
      foot: [
        "Total",
        "",
        data.rows.reduce((s, r) => s + r.unpaidCount, 0),
        money(data.totals.current),
        money(data.totals.d30),
        money(data.totals.d60),
        money(data.totals.d90),
        money(data.totals.d90plus),
        money(data.total),
      ],
      emptyMessage: "Nothing owed to suppliers.",
    },
  );

  if (data.unattached.length > 0) {
    drawSectionHeading(ctx, "Unpaid with no supplier recorded");
    drawTable(
      ctx,
      [
        { header: "Date", key: "date" },
        { header: "Category", key: "category" },
        { header: "Note", key: "notes" },
        { header: "Amount", key: "amount", align: "right" },
      ],
      data.unattached.map((row) => ({
        date: shortDate(row.date),
        category: row.category,
        notes: row.notes || "—",
        amount: money(row.amount),
      })),
      { foot: ["Total", "", "", money(data.unattachedTotal)] },
    );
  }

  drawNotes(
    ctx,
    "How ageing is counted",
    "An unpaid business expense falls due on its own date plus that " +
      "supplier's payment terms, which is the only due date the records hold. " +
      "A supplier carrying a ledger balance but no unpaid entries is still " +
      "listed, because the balance is the authority on what is owed.",
  );

  return finalise(ctx, { note: "Creditors" });
}

// ---------------------------------------------------------------------------

export function generateCashFlowPDF(params: {
  organization: OrganizationLike | null;
  data: CashFlowData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    title: "Cash flow",
  });

  drawHeader(ctx, { title: "Cash Flow", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Cash in", value: money(data.cashIn), tone: "green" },
    { label: "Cash out", value: money(data.cashOut) },
    {
      label: "Net movement",
      value: money(data.net),
      tone: data.net >= 0 ? "green" : "danger",
    },
    {
      label: "Closing balances",
      value: money(data.accounts.reduce((s, a) => s + a.closing, 0)),
    },
  ]);

  drawSectionHeading(ctx, "Month by month");
  drawTable(
    ctx,
    [
      { header: "Month", key: "month" },
      { header: "From customers", key: "customerReceipts", align: "right" },
      { header: "To suppliers", key: "supplierPayments", align: "right" },
      { header: "Other spend", key: "otherSpend", align: "right" },
      { header: "Net", key: "net", align: "right" },
    ],
    data.monthly.map((row) => ({
      month: row.month,
      customerReceipts: money(row.customerReceipts),
      supplierPayments: money(row.supplierPayments),
      otherSpend: money(row.otherSpend),
      net: money(row.net),
    })),
    {
      foot: [
        "Total",
        money(data.cashIn),
        money(data.monthly.reduce((s, m) => s + m.supplierPayments, 0)),
        money(data.monthly.reduce((s, m) => s + m.otherSpend, 0)),
        money(data.net),
      ],
      emptyMessage: "No cash movement in this period.",
    },
  );

  drawSectionHeading(ctx, "By account");
  drawTable(
    ctx,
    [
      { header: "Account", key: "name" },
      { header: "Opening", key: "opening", align: "right" },
      { header: "In", key: "paidIn", align: "right" },
      { header: "Out", key: "paidOut", align: "right" },
      { header: "Closing", key: "closing", align: "right" },
    ],
    data.accounts.map((row) => ({
      name: row.name,
      opening: money(row.opening),
      paidIn: money(row.paidIn),
      paidOut: money(row.paidOut),
      closing: money(row.closing),
    })),
    {
      foot: [
        "Total",
        money(data.accounts.reduce((s, a) => s + a.opening, 0)),
        money(data.accounts.reduce((s, a) => s + a.paidIn, 0)),
        money(data.accounts.reduce((s, a) => s + a.paidOut, 0)),
        money(data.accounts.reduce((s, a) => s + a.closing, 0)),
      ],
      emptyMessage: "No accounts configured.",
    },
  );

  drawSectionHeading(ctx, "Where the money went");
  drawTable(
    ctx,
    [
      { header: "Category", key: "category" },
      { header: "Amount", key: "amount", align: "right" },
      { header: "Share", key: "share", align: "right" },
    ],
    data.outflowByCategory.map((row) => ({
      category: row.category,
      amount: money(row.amount),
      share: pct(row.share),
    })),
    { emptyMessage: "No spending recorded in this period." },
  );

  drawNotes(
    ctx,
    "Basis",
    "Cash in is money actually received from customers, not invoiced. Cash " +
      "out counts payments made to suppliers plus spending that was not billed " +
      "through a supplier — an expense owed to a supplier is counted when that " +
      "supplier is paid, so the same money never leaves twice. The account " +
      "table reflects only spending that was drawn from a configured account.",
  );

  return finalise(ctx, { note: "Cash Flow" });
}
