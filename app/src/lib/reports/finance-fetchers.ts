import "server-only";

/**
 * Data for the four money reports an owner actually makes decisions on:
 * profit and loss, who owes us, who we owe, and what the cash did.
 *
 * Every figure here comes from the same primitives the dashboard uses
 * (`lib/metrics/revenue.ts`), so a report and the screen it was generated
 * from can never disagree. Where a report needs a definition the rest of the
 * app doesn't have — an ageing bucket, say — the rule is written down next to
 * the code rather than left implicit.
 */

import { prisma } from "@/lib/prisma";
import { earnedRevenueWhere, getEarnedRevenue } from "@/lib/metrics/revenue";
import { costKindLabel } from "@/lib/metrics/cost-kinds";
import { isDebitTransaction } from "@/lib/accounts";
import { addMonths, format, startOfMonth } from "date-fns";

const round = (value: number) => Math.round(value * 100) / 100;

const share = (part: number, whole: number) =>
  whole === 0 ? 0 : round((part / whole) * 100);

/** Months the period touches, so a quiet month shows as zero, not a gap. */
function monthKeys(from: Date, to: Date): string[] {
  const keys: string[] = [];
  for (let cursor = startOfMonth(from); cursor <= to; cursor = addMonths(cursor, 1)) {
    keys.push(format(cursor, "yyyy-MM"));
  }
  return keys;
}

const monthLabel = (key: string) =>
  format(new Date(`${key}-01T00:00:00`), "MMM yyyy");

// ---------------------------------------------------------------------------
// Profit and loss

export interface ProfitAndLossData {
  from: Date;
  to: Date;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  tripCount: number;
  revenueByCustomer: Array<{
    customer: string;
    trips: number;
    revenue: number;
    share: number;
  }>;
  expensesByCategory: Array<{
    category: string;
    kind: string;
    count: number;
    amount: number;
    share: number;
  }>;
  monthly: Array<{
    month: string;
    revenue: number;
    expenses: number;
    profit: number;
  }>;
  /** The same totals for the preceding window of equal length. */
  previous: { revenue: number; expenses: number; profit: number } | null;
}

export async function fetchProfitAndLossData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<ProfitAndLossData> {
  const [trips, expenses] = await Promise.all([
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, from, to),
      select: {
        revenue: true,
        endDate: true,
        scheduledDate: true,
        customer: { select: { name: true } },
      },
    }),
    prisma.expense.findMany({
      where: { organizationId, date: { gte: from, lte: to } },
      select: {
        amount: true,
        date: true,
        category: { select: { name: true, kind: true } },
      },
    }),
  ]);

  const revenue = round(trips.reduce((sum, t) => sum + (t.revenue || 0), 0));
  const totalExpenses = round(expenses.reduce((sum, e) => sum + e.amount, 0));
  const profit = round(revenue - totalExpenses);

  // Trips with no customer are grouped rather than dropped: they still earned
  // money, and the breakdown has to reconcile to the total.
  const customers = new Map<string, { trips: number; revenue: number }>();
  for (const trip of trips) {
    const name = trip.customer?.name ?? "No customer recorded";
    const row = customers.get(name) ?? { trips: 0, revenue: 0 };
    row.trips += 1;
    row.revenue += trip.revenue || 0;
    customers.set(name, row);
  }

  const categories = new Map<
    string,
    { kind: string; count: number; amount: number }
  >();
  for (const expense of expenses) {
    const name = expense.category?.name ?? "Uncategorised";
    const row = categories.get(name) ?? {
      kind: costKindLabel(expense.category?.kind),
      count: 0,
      amount: 0,
    };
    row.count += 1;
    row.amount += expense.amount;
    categories.set(name, row);
  }

  const buckets = new Map<string, { revenue: number; expenses: number }>();
  for (const key of monthKeys(from, to)) {
    buckets.set(key, { revenue: 0, expenses: 0 });
  }
  for (const trip of trips) {
    const bucket = buckets.get(format(trip.endDate ?? trip.scheduledDate, "yyyy-MM"));
    if (bucket) bucket.revenue += trip.revenue || 0;
  }
  for (const expense of expenses) {
    const bucket = buckets.get(format(expense.date, "yyyy-MM"));
    if (bucket) bucket.expenses += expense.amount;
  }

  const monthly = Array.from(buckets.entries()).map(([key, bucket]) => ({
    month: monthLabel(key),
    revenue: round(bucket.revenue),
    expenses: round(bucket.expenses),
    profit: round(bucket.revenue - bucket.expenses),
  }));

  // The preceding window of the same length, for a like-for-like comparison.
  const span = to.getTime() - from.getTime();
  const prevTo = new Date(from.getTime() - 1);
  const prevFrom = new Date(prevTo.getTime() - span);
  const [prevRevenue, prevExpenseAgg] = await Promise.all([
    getEarnedRevenue(organizationId, prevFrom, prevTo),
    prisma.expense.aggregate({
      where: { organizationId, date: { gte: prevFrom, lte: prevTo } },
      _sum: { amount: true },
    }),
  ]);
  const prevExpenses = round(prevExpenseAgg._sum.amount || 0);

  return {
    from,
    to,
    revenue,
    expenses: totalExpenses,
    profit,
    margin: share(profit, revenue),
    tripCount: trips.length,
    revenueByCustomer: Array.from(customers.entries())
      .map(([customer, row]) => ({
        customer,
        trips: row.trips,
        revenue: round(row.revenue),
        share: share(row.revenue, revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue),
    expensesByCategory: Array.from(categories.entries())
      .map(([category, row]) => ({
        category,
        kind: row.kind,
        count: row.count,
        amount: round(row.amount),
        share: share(row.amount, totalExpenses),
      }))
      .sort((a, b) => b.amount - a.amount),
    monthly,
    previous:
      prevRevenue === 0 && prevExpenses === 0
        ? null
        : {
            revenue: prevRevenue,
            expenses: prevExpenses,
            profit: round(prevRevenue - prevExpenses),
          },
  };
}

// ---------------------------------------------------------------------------
// Ageing, shared by debtors and creditors

/**
 * "Current" means not yet due; every other bucket counts days *past the due
 * date*, so an invoice due tomorrow is never shown as overdue no matter how
 * long ago it was raised.
 */
export const AGEING_BUCKETS = [
  { key: "current", label: "Current" },
  { key: "d30", label: "1-30 days" },
  { key: "d60", label: "31-60 days" },
  { key: "d90", label: "61-90 days" },
  { key: "d90plus", label: "90+ days" },
] as const;

export type AgeingBucketKey = (typeof AGEING_BUCKETS)[number]["key"];

export type AgeingBuckets = Record<AgeingBucketKey, number>;

export function ageingBucketFor(
  dueDate: Date | null,
  asOf: Date,
): AgeingBucketKey {
  if (!dueDate) return "current";
  const days = Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000);
  if (days <= 0) return "current";
  if (days <= 30) return "d30";
  if (days <= 60) return "d60";
  if (days <= 90) return "d90";
  return "d90plus";
}

const emptyBuckets = (): AgeingBuckets => ({
  current: 0,
  d30: 0,
  d60: 0,
  d90: 0,
  d90plus: 0,
});

const roundBuckets = (b: AgeingBuckets): AgeingBuckets => ({
  current: round(b.current),
  d30: round(b.d30),
  d60: round(b.d60),
  d90: round(b.d90),
  d90plus: round(b.d90plus),
});

export const bucketLabel = (key: AgeingBucketKey): string =>
  AGEING_BUCKETS.find((b) => b.key === key)?.label ?? "";

// ---------------------------------------------------------------------------
// Aged receivables — who owes us

export interface AgedReceivablesData {
  asOf: Date;
  total: number;
  totals: AgeingBuckets;
  rows: Array<{
    customer: string;
    phone: string | null;
    invoices: number;
    oldestDays: number;
    total: number;
    buckets: AgeingBuckets;
  }>;
  detail: Array<{
    customer: string;
    invoiceNumber: string;
    issueDate: Date;
    dueDate: Date | null;
    daysOverdue: number;
    total: number;
    paid: number;
    balance: number;
    bucket: string;
  }>;
}

export async function fetchAgedReceivablesData(
  organizationId: string,
  asOf: Date,
): Promise<AgedReceivablesData> {
  // A cancelled or draft invoice is not a debt, and a settled one is not
  // outstanding. Everything else raised on or before the report date counts.
  const invoices = await prisma.invoice.findMany({
    where: {
      organizationId,
      status: { notIn: ["cancelled", "draft"] },
      balance: { gt: 0 },
      issueDate: { lte: asOf },
    },
    select: {
      invoiceNumber: true,
      issueDate: true,
      dueDate: true,
      total: true,
      amountPaid: true,
      balance: true,
      customer: { select: { name: true, phone: true } },
    },
    orderBy: { issueDate: "asc" },
  });

  const byCustomer = new Map<
    string,
    {
      phone: string | null;
      invoices: number;
      oldestDays: number;
      total: number;
      buckets: AgeingBuckets;
    }
  >();
  const totals = emptyBuckets();
  const detail: AgedReceivablesData["detail"] = [];

  for (const invoice of invoices) {
    const name = invoice.customer?.name ?? "No customer";
    const bucket = ageingBucketFor(invoice.dueDate, asOf);
    const daysOverdue = invoice.dueDate
      ? Math.max(
          0,
          Math.floor((asOf.getTime() - invoice.dueDate.getTime()) / 86_400_000),
        )
      : 0;

    const row = byCustomer.get(name) ?? {
      phone: invoice.customer?.phone ?? null,
      invoices: 0,
      oldestDays: 0,
      total: 0,
      buckets: emptyBuckets(),
    };
    row.invoices += 1;
    row.total += invoice.balance;
    row.buckets[bucket] += invoice.balance;
    row.oldestDays = Math.max(row.oldestDays, daysOverdue);
    byCustomer.set(name, row);

    totals[bucket] += invoice.balance;

    detail.push({
      customer: name,
      invoiceNumber: invoice.invoiceNumber,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      daysOverdue,
      total: round(invoice.total),
      paid: round(invoice.amountPaid),
      balance: round(invoice.balance),
      bucket: bucketLabel(bucket),
    });
  }

  const rows = Array.from(byCustomer.entries())
    .map(([customer, row]) => ({
      customer,
      phone: row.phone,
      invoices: row.invoices,
      oldestDays: row.oldestDays,
      total: round(row.total),
      buckets: roundBuckets(row.buckets),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    asOf,
    total: round(rows.reduce((sum, r) => sum + r.total, 0)),
    totals: roundBuckets(totals),
    rows,
    detail: detail.sort((a, b) => b.daysOverdue - a.daysOverdue),
  };
}

// ---------------------------------------------------------------------------
// Creditors — who we owe

export interface CreditorsData {
  asOf: Date;
  total: number;
  totals: AgeingBuckets;
  rows: Array<{
    supplier: string;
    terms: number;
    unpaidCount: number;
    ledgerBalance: number;
    total: number;
    buckets: AgeingBuckets;
  }>;
  /** Unpaid business expenses with no supplier attached to them. */
  unattached: Array<{
    date: Date;
    category: string;
    notes: string;
    amount: number;
  }>;
  unattachedTotal: number;
}

export async function fetchCreditorsData(
  organizationId: string,
  asOf: Date,
): Promise<CreditorsData> {
  const [suppliers, unpaid] = await Promise.all([
    prisma.supplier.findMany({
      where: { organizationId },
      select: { id: true, name: true, paymentTerms: true, balance: true },
    }),
    // An unpaid business expense is money owed. Its due date is the expense
    // date plus that supplier's terms — the only due date the schema holds.
    prisma.expense.findMany({
      where: {
        organizationId,
        isBusinessExpense: true,
        isPaid: false,
        date: { lte: asOf },
      },
      select: {
        date: true,
        amount: true,
        notes: true,
        supplierId: true,
        category: { select: { name: true } },
      },
      orderBy: { date: "asc" },
    }),
  ]);

  const supplierById = new Map(suppliers.map((s) => [s.id, s]));
  const bySupplier = new Map<
    string,
    {
      terms: number;
      unpaidCount: number;
      ledgerBalance: number;
      total: number;
      buckets: AgeingBuckets;
    }
  >();
  const totals = emptyBuckets();
  const unattached: CreditorsData["unattached"] = [];

  for (const expense of unpaid) {
    const supplier = expense.supplierId
      ? supplierById.get(expense.supplierId)
      : undefined;

    if (!supplier) {
      unattached.push({
        date: expense.date,
        category: expense.category?.name ?? "Uncategorised",
        notes: expense.notes ?? "",
        amount: round(expense.amount),
      });
      continue;
    }

    const due = new Date(expense.date);
    due.setDate(due.getDate() + (supplier.paymentTerms || 0));
    const bucket = ageingBucketFor(due, asOf);

    const row = bySupplier.get(supplier.name) ?? {
      terms: supplier.paymentTerms,
      unpaidCount: 0,
      ledgerBalance: round(supplier.balance),
      total: 0,
      buckets: emptyBuckets(),
    };
    row.unpaidCount += 1;
    row.total += expense.amount;
    row.buckets[bucket] += expense.amount;
    bySupplier.set(supplier.name, row);

    totals[bucket] += expense.amount;
  }

  // A supplier carrying a ledger balance but no unpaid expense rows still
  // belongs on a creditors report — the balance is the authority on the debt.
  for (const supplier of suppliers) {
    if (supplier.balance > 0 && !bySupplier.has(supplier.name)) {
      bySupplier.set(supplier.name, {
        terms: supplier.paymentTerms,
        unpaidCount: 0,
        ledgerBalance: round(supplier.balance),
        total: 0,
        buckets: emptyBuckets(),
      });
    }
  }

  const rows = Array.from(bySupplier.entries())
    .map(([supplier, row]) => ({
      supplier,
      terms: row.terms,
      unpaidCount: row.unpaidCount,
      ledgerBalance: row.ledgerBalance,
      total: round(row.total),
      buckets: roundBuckets(row.buckets),
    }))
    .sort((a, b) => b.total - a.total || b.ledgerBalance - a.ledgerBalance);

  return {
    asOf,
    total: round(rows.reduce((sum, r) => sum + r.total, 0)),
    totals: roundBuckets(totals),
    rows,
    unattached,
    unattachedTotal: round(unattached.reduce((sum, r) => sum + r.amount, 0)),
  };
}

// ---------------------------------------------------------------------------
// Cash flow

export interface CashFlowData {
  from: Date;
  to: Date;
  cashIn: number;
  cashOut: number;
  net: number;
  monthly: Array<{
    month: string;
    customerReceipts: number;
    supplierPayments: number;
    otherSpend: number;
    net: number;
  }>;
  accounts: Array<{
    name: string;
    type: string;
    opening: number;
    paidIn: number;
    paidOut: number;
    closing: number;
  }>;
  outflowByCategory: Array<{
    category: string;
    amount: number;
    share: number;
  }>;
}

export async function fetchCashFlowData(
  organizationId: string,
  from: Date,
  to: Date,
): Promise<CashFlowData> {
  const [receipts, supplierPayments, expenses, accounts] = await Promise.all([
    prisma.payment.findMany({
      where: { customer: { organizationId }, paymentDate: { gte: from, lte: to } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.supplierPayment.findMany({
      where: { organizationId, paymentDate: { gte: from, lte: to } },
      select: { amount: true, paymentDate: true },
    }),
    prisma.expense.findMany({
      where: { organizationId, date: { gte: from, lte: to } },
      select: {
        amount: true,
        date: true,
        supplierId: true,
        isBusinessExpense: true,
        category: { select: { name: true } },
      },
    }),
    prisma.financialAccount.findMany({
      where: { organizationId },
      select: { id: true, name: true, type: true, startingBalance: true },
      orderBy: { type: "asc" },
    }),
  ]);

  const buckets = new Map<
    string,
    { customerReceipts: number; supplierPayments: number; otherSpend: number }
  >();
  for (const key of monthKeys(from, to)) {
    buckets.set(key, {
      customerReceipts: 0,
      supplierPayments: 0,
      otherSpend: 0,
    });
  }

  for (const receipt of receipts) {
    const bucket = buckets.get(format(receipt.paymentDate, "yyyy-MM"));
    if (bucket) bucket.customerReceipts += receipt.amount;
  }
  for (const payment of supplierPayments) {
    const bucket = buckets.get(format(payment.paymentDate, "yyyy-MM"));
    if (bucket) bucket.supplierPayments += payment.amount;
  }
  // An expense owed to a supplier leaves the bank when the supplier is paid,
  // and that payment is already counted above. Counting it here as well would
  // send the same money out twice.
  for (const expense of expenses) {
    if (expense.isBusinessExpense && expense.supplierId) continue;
    const bucket = buckets.get(format(expense.date, "yyyy-MM"));
    if (bucket) bucket.otherSpend += expense.amount;
  }

  const monthly = Array.from(buckets.entries()).map(([key, bucket]) => ({
    month: monthLabel(key),
    customerReceipts: round(bucket.customerReceipts),
    supplierPayments: round(bucket.supplierPayments),
    otherSpend: round(bucket.otherSpend),
    net: round(
      bucket.customerReceipts - bucket.supplierPayments - bucket.otherSpend,
    ),
  }));

  const cashIn = round(monthly.reduce((s, m) => s + m.customerReceipts, 0));
  const cashOut = round(
    monthly.reduce((s, m) => s + m.supplierPayments + m.otherSpend, 0),
  );

  // Per-account movement, on the same basis as the account ledger report.
  const accountIds = accounts.map((a) => a.id);
  const [priorRows, movementRows] = await Promise.all([
    prisma.accountTransaction.findMany({
      where: { accountId: { in: accountIds }, date: { lt: from } },
      orderBy: { date: "desc" },
      select: { accountId: true, balanceAfter: true, date: true },
    }),
    prisma.accountTransaction.findMany({
      where: { accountId: { in: accountIds }, date: { gte: from, lte: to } },
      orderBy: { date: "asc" },
      select: { accountId: true, type: true, amount: true, balanceAfter: true },
    }),
  ]);

  const openingByAccount = new Map<string, number>();
  for (const row of priorRows) {
    // Ordered newest first, so the first row seen for an account is its
    // closing balance immediately before the period.
    if (!openingByAccount.has(row.accountId)) {
      openingByAccount.set(row.accountId, row.balanceAfter);
    }
  }

  const accountRows = accounts.map((account) => {
    const movements = movementRows.filter((m) => m.accountId === account.id);
    const opening = openingByAccount.get(account.id) ?? account.startingBalance;
    const paidOut = movements
      .filter((m) => isDebitTransaction(m.type))
      .reduce((sum, m) => sum + m.amount, 0);
    const paidIn = movements
      .filter((m) => !isDebitTransaction(m.type))
      .reduce((sum, m) => sum + m.amount, 0);

    return {
      name: account.name,
      type: account.type,
      opening: round(opening),
      paidIn: round(paidIn),
      paidOut: round(paidOut),
      closing: round(
        movements.length > 0
          ? movements[movements.length - 1].balanceAfter
          : opening,
      ),
    };
  });

  const categories = new Map<string, number>();
  for (const expense of expenses) {
    const name = expense.category?.name ?? "Uncategorised";
    categories.set(name, (categories.get(name) ?? 0) + expense.amount);
  }
  const categoryTotal = Array.from(categories.values()).reduce((s, v) => s + v, 0);

  return {
    from,
    to,
    cashIn,
    cashOut,
    net: round(cashIn - cashOut),
    monthly,
    accounts: accountRows,
    outflowByCategory: Array.from(categories.entries())
      .map(([category, amount]) => ({
        category,
        amount: round(amount),
        share: share(amount, categoryTotal),
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}
