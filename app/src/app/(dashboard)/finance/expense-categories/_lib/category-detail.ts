import "server-only";

/**
 * The data behind one expense category's detail page.
 *
 * The category list could say how many expenses a category held and nothing
 * else — not what it cost, not what it was spent on, not whether it was
 * growing. This assembles the answer: a period total with a comparison
 * against the previous window, a month-by-month trend, and every individual
 * expense with what it was linked to.
 *
 * The hard part is the links. An expense can name several trucks, trailers,
 * trips and drivers at once, so filtering by truck has to be a `some` test on
 * the expense rather than a scan of the join table — otherwise an expense
 * shared between two trucks appears twice in a list that is supposed to hold
 * one row per expense, and the rows stop adding up to the total above them.
 */

import { prisma } from "@/lib/prisma";
import type { DateRangeValue } from "@/lib/period-utils";
import { previousPeriod } from "@/lib/period-range";
import { groupByMonth } from "@/lib/metrics/monthly";

export interface CategoryExpenseFilters {
  truckId?: string;
  trailerId?: string;
  tripId?: string;
  driverId?: string;
  supplierId?: string;
  /** "paid" | "unpaid"; anything else means both. */
  paid?: string;
}

export interface CategoryExpenseRow {
  id: string;
  date: Date;
  amount: number;
  description: string;
  vendor: string | null;
  reference: string | null;
  isPaid: boolean;
  paidDate: Date | null;
  supplier: { id: string; name: string } | null;
  trucks: Array<{ id: string; registrationNo: string }>;
  trailers: Array<{ id: string; registrationNo: string }>;
  trips: Array<{ id: string; label: string }>;
  drivers: Array<{ id: string; name: string }>;
  /** True when the expense is attached to more than one entity of a kind. */
  isShared: boolean;
}

export interface CategoryDetail {
  total: number;
  count: number;
  average: number;
  paid: number;
  unpaid: number;
  /** Total over the window of the same length immediately before this one. */
  previousTotal: number;
  /** null when the previous window had nothing to compare against. */
  changePercent: number | null;
  monthly: Array<{ month: string; key: string; amount: number; count: number }>;
  rows: CategoryExpenseRow[];
  /** True when more rows exist than were returned. */
  truncated: boolean;
}

/** How many expense rows the table shows before it says there are more. */
const ROW_LIMIT = 500;

export function categoryExpenseWhere(
  organizationId: string,
  categoryId: string,
  range: { from: Date; to: Date },
  filters: CategoryExpenseFilters,
) {
  const paid =
    filters.paid === "paid" ? true : filters.paid === "unpaid" ? false : undefined;

  return {
    organizationId,
    categoryId,
    date: { gte: range.from, lte: range.to },
    ...(paid === undefined ? {} : { isPaid: paid }),
    ...(filters.supplierId ? { supplierId: filters.supplierId } : {}),
    // `some` on the expense, never a scan of the join table: an expense
    // linked to two trucks must still be one row.
    ...(filters.truckId
      ? { truckExpenses: { some: { truckId: filters.truckId } } }
      : {}),
    ...(filters.trailerId
      ? { trailerExpenses: { some: { trailerId: filters.trailerId } } }
      : {}),
    ...(filters.tripId
      ? { tripExpenses: { some: { tripId: filters.tripId } } }
      : {}),
    ...(filters.driverId
      ? { driverExpenses: { some: { driverId: filters.driverId } } }
      : {}),
  };
}

export async function getCategoryDetail(
  organizationId: string,
  categoryId: string,
  range: DateRangeValue,
  filters: CategoryExpenseFilters,
): Promise<CategoryDetail> {
  const where = categoryExpenseWhere(organizationId, categoryId, range, filters);
  const prior = previousPeriod(range);

  const [totals, paidAgg, unpaidAgg, previousAgg, rows, totalCount] =
    await Promise.all([
      prisma.expense.aggregate({ where, _sum: { amount: true }, _count: true }),
      prisma.expense.aggregate({
        where: { ...where, isPaid: true },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { ...where, isPaid: false },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: categoryExpenseWhere(organizationId, categoryId, prior, filters),
        _sum: { amount: true },
      }),
      prisma.expense.findMany({
        where,
        orderBy: { date: "desc" },
        take: ROW_LIMIT,
        include: {
          supplier: { select: { id: true, name: true } },
          truckExpenses: {
            include: { truck: { select: { id: true, registrationNo: true } } },
          },
          trailerExpenses: {
            include: { trailer: { select: { id: true, registrationNo: true } } },
          },
          tripExpenses: {
            include: {
              trip: {
                select: {
                  id: true,
                  originCity: true,
                  destinationCity: true,
                },
              },
            },
          },
          driverExpenses: {
            include: {
              driver: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      }),
      prisma.expense.count({ where }),
    ]);

  const total = totals._sum.amount ?? 0;
  const count = totals._count;
  const previousTotal = previousAgg._sum.amount ?? 0;

  // The monthly trend is built from the returned rows when they are complete,
  // and from a dedicated grouped query when the table was truncated — a chart
  // that silently plots only the newest 500 expenses is worse than no chart.
  const monthlySource =
    totalCount > ROW_LIMIT
      ? await prisma.expense.findMany({
          where,
          select: { date: true, amount: true },
        })
      : rows.map((r) => ({ date: r.date, amount: r.amount }));

  const monthly = groupByMonth(
    monthlySource,
    (row) => row.date,
    () => ({ amount: 0, count: 0 }),
    (acc, row) => ({ amount: acc.amount + row.amount, count: acc.count + 1 }),
  ).map((group) => ({
    month: group.month,
    key: group.key,
    amount: Math.round(group.value.amount * 100) / 100,
    count: group.value.count,
  }));

  return {
    total,
    count,
    average: count > 0 ? total / count : 0,
    paid: paidAgg._sum.amount ?? 0,
    unpaid: unpaidAgg._sum.amount ?? 0,
    previousTotal,
    changePercent:
      previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : null,
    monthly,
    truncated: totalCount > ROW_LIMIT,
    rows: rows.map((expense): CategoryExpenseRow => {
      const trucks = expense.truckExpenses.map((te) => te.truck);
      const trailers = expense.trailerExpenses.map((te) => te.trailer);
      const trips = expense.tripExpenses.map((te) => ({
        id: te.trip.id,
        label: `${te.trip.originCity} → ${te.trip.destinationCity}`,
      }));
      const drivers = expense.driverExpenses.map((de) => ({
        id: de.driver.id,
        name: `${de.driver.firstName} ${de.driver.lastName}`,
      }));

      return {
        id: expense.id,
        date: expense.date,
        amount: expense.amount,
        description: expense.description || expense.notes || "—",
        vendor: expense.vendor,
        reference: expense.reference,
        isPaid: expense.isPaid,
        paidDate: expense.paidDate,
        supplier: expense.supplier,
        trucks,
        trailers,
        trips,
        drivers,
        // Flagged in the UI because a shared cost is split when it is
        // attributed to a single truck or driver elsewhere in the app.
        isShared:
          trucks.length > 1 ||
          trailers.length > 1 ||
          trips.length > 1 ||
          drivers.length > 1,
      };
    }),
  };
}
