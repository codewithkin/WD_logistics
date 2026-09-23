import "server-only";

/**
 * The paper trail behind "is this truck running us a loss, and where?"
 *
 * The trucks list already showed revenue against expenses per truck, which
 * answers the first half. This answers the second: what the money went on,
 * how that compares with the rest of the fleet, and whether the problem is
 * fuel economy or time in the workshop.
 *
 * Two rules that everything here obeys, and that anything reusing it must:
 *
 * **Shared costs are split.** An expense linked to three trucks counts a
 * third against each. Attributing the whole amount to every truck it names is
 * how the old per-truck figures managed to sum to more than the company
 * actually spent.
 *
 * **Revenue means completed trips.** It comes from lib/metrics/revenue.ts,
 * not a fourth local definition, so the profit line here agrees with the
 * dashboard and the reports.
 */

import { prisma } from "@/lib/prisma";
import { earnedRevenueWhere } from "@/lib/metrics/revenue";
import { costKindLabel, type CostKind } from "@/lib/metrics/cost-kinds";
import { groupByMonth } from "@/lib/metrics/monthly";

export interface CategoryCost {
  categoryId: string;
  category: string;
  kind: string | null;
  kindLabel: string;
  amount: number;
  count: number;
  /** Share of this truck's total cost, 0–100. */
  share: number;
  /** The same category's share across the fleet, for comparison. */
  fleetShare: number;
  /**
   * True when this truck spends materially more of its budget here than the
   * fleet does — the "where is the problem" signal.
   */
  aboveFleetAverage: boolean;
}

export interface TruckCostExpense {
  id: string;
  date: Date;
  amount: number;
  /** What this truck bears after splitting a shared cost. */
  attributed: number;
  description: string;
  category: string;
  categoryId: string;
  supplier: string | null;
  /** Direct truck cost, or inherited from one of its trips. */
  source: "truck" | "trip";
  tripLabel: string | null;
  tripId: string | null;
  /** How many records the cost was split across. */
  sharedWith: number;
}

export interface TruckCostBreakdown {
  revenue: number;
  expenses: number;
  profit: number;
  /** Profit as a percentage of revenue; null when there was no revenue. */
  margin: number | null;
  trips: number;
  /** Kilometres actually driven on completed trips in the period. */
  kilometres: number;
  revenuePerKm: number | null;
  costPerKm: number | null;
  fuelSpend: number;
  fuelPerKm: number | null;
  maintenanceSpend: number;
  /** Days the truck was off the road, from the workshop records. */
  downtimeDays: number;
  openJobs: number;
  maintenanceJobs: number;
  byCategory: CategoryCost[];
  byMonth: Array<{ month: string; key: string; revenue: number; expenses: number }>;
  expenses_list: TruckCostExpense[];
  /** Fleet averages, so one truck can be read against the rest. */
  fleet: {
    trucks: number;
    averageProfit: number;
    averageCostPerKm: number | null;
    averageFuelPerKm: number | null;
  };
}

/** A category's share is "above average" once it exceeds the fleet's by this. */
const ABOVE_AVERAGE_THRESHOLD = 1.2;

interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Every expense touching a truck in the period, with the attributed share
 * already worked out.
 *
 * Deliberately one query per source rather than a join-table scan: an expense
 * naming two trucks must produce one row per truck carrying half the amount,
 * not two rows carrying all of it.
 */
async function loadTruckExpenses(
  organizationId: string,
  truckIds: string[],
  range: DateRange,
): Promise<Map<string, TruckCostExpense[]>> {
  const byTruck = new Map<string, TruckCostExpense[]>();
  for (const id of truckIds) byTruck.set(id, []);

  // An expense can name a truck *and* a trip that truck ran — fuel bought for
  // a specific run, entered against both. Without this it would be counted
  // twice against the same truck, and the per-truck totals would sum to more
  // than the company actually spent. The direct link wins.
  const counted = new Set<string>();

  // ---- Costs booked directly against a truck ----
  const direct = await prisma.expense.findMany({
    where: {
      organizationId,
      date: { gte: range.from, lte: range.to },
      truckExpenses: { some: { truckId: { in: truckIds } } },
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { name: true } },
      // Every truck the cost names, including ones outside `truckIds`, because
      // the split is over all of them.
      truckExpenses: { select: { truckId: true } },
    },
  });

  for (const expense of direct) {
    const linked = expense.truckExpenses.length || 1;
    const attributed = expense.amount / linked;
    for (const link of expense.truckExpenses) {
      const bucket = byTruck.get(link.truckId);
      if (!bucket) continue;
      counted.add(`${expense.id}:${link.truckId}`);
      bucket.push({
        id: expense.id,
        date: expense.date,
        amount: expense.amount,
        attributed,
        description: expense.description || expense.notes || "—",
        category: expense.category.name,
        categoryId: expense.category.id,
        supplier: expense.supplier?.name ?? null,
        source: "truck",
        tripLabel: null,
        tripId: null,
        sharedWith: linked,
      });
    }
  }

  // ---- Costs booked against a trip this truck ran ----
  //
  // A trip cost belongs to the truck that ran it: fuel burned on a Beira run
  // is that truck's fuel, however it was entered.
  const tripCosts = await prisma.expense.findMany({
    where: {
      organizationId,
      date: { gte: range.from, lte: range.to },
      tripExpenses: { some: { trip: { truckId: { in: truckIds } } } },
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { name: true } },
      tripExpenses: {
        select: {
          trip: {
            select: {
              id: true,
              truckId: true,
              originCity: true,
              destinationCity: true,
            },
          },
        },
      },
    },
  });

  for (const expense of tripCosts) {
    const linked = expense.tripExpenses.length || 1;
    const attributed = expense.amount / linked;
    for (const link of expense.tripExpenses) {
      const bucket = byTruck.get(link.trip.truckId);
      if (!bucket) continue;
      // Already booked directly against this truck above.
      if (counted.has(`${expense.id}:${link.trip.truckId}`)) continue;
      counted.add(`${expense.id}:${link.trip.truckId}`);
      bucket.push({
        id: expense.id,
        date: expense.date,
        amount: expense.amount,
        attributed,
        description: expense.description || expense.notes || "—",
        category: expense.category.name,
        categoryId: expense.category.id,
        supplier: expense.supplier?.name ?? null,
        source: "trip",
        tripLabel: `${link.trip.originCity} → ${link.trip.destinationCity}`,
        tripId: link.trip.id,
        sharedWith: linked,
      });
    }
  }

  return byTruck;
}

/** Days between a job being raised and closed, for downtime. */
function downtimeDays(date: Date, fixedAt: Date | null): number {
  const end = fixedAt ?? new Date();
  const days = (end.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
  return days > 0 ? days : 0;
}

export async function getTruckCostBreakdown(
  organizationId: string,
  truckId: string,
  range: DateRange,
): Promise<TruckCostBreakdown> {
  const [
    revenueAgg,
    trips,
    expensesByTruck,
    categories,
    maintenance,
    fleetTruckIds,
  ] = await Promise.all([
    prisma.trip.aggregate({
      where: earnedRevenueWhere(organizationId, range.from, range.to, {
        truckId,
      }),
      _sum: { revenue: true },
      _count: true,
    }),
    // Kilometres come from completed trips only, to match the revenue they
    // sit beside — a cost per km that mixes scheduled trips into the
    // denominator flatters every truck.
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, range.from, range.to, {
        truckId,
      }),
      select: {
        actualMileage: true,
        estimatedMileage: true,
        revenue: true,
        endDate: true,
        scheduledDate: true,
      },
    }),
    loadTruckExpenses(organizationId, [truckId], range),
    prisma.expenseCategory.findMany({
      where: { organizationId },
      select: { id: true, name: true, kind: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: {
        organizationId,
        truckId,
        OR: [
          { date: { gte: range.from, lte: range.to } },
          { fixedAt: { gte: range.from, lte: range.to } },
        ],
      },
      select: { date: true, fixedAt: true, status: true },
    }),
    prisma.truck.findMany({
      where: { organizationId },
      select: { id: true },
    }),
  ]);

  const expenses = expensesByTruck.get(truckId) ?? [];
  const kindByCategory = new Map(categories.map((c) => [c.id, c.kind]));

  const totalExpenses = expenses.reduce((sum, e) => sum + e.attributed, 0);
  const revenue = revenueAgg._sum.revenue ?? 0;
  const kilometres = trips.reduce(
    (sum, trip) => sum + (trip.actualMileage ?? trip.estimatedMileage ?? 0),
    0,
  );

  // ---- By category, with the fleet's own split for comparison ----
  const truckByCategory = new Map<string, { amount: number; count: number }>();
  for (const expense of expenses) {
    const bucket = truckByCategory.get(expense.categoryId) ?? {
      amount: 0,
      count: 0,
    };
    bucket.amount += expense.attributed;
    bucket.count += 1;
    truckByCategory.set(expense.categoryId, bucket);
  }

  const fleetExpenses = await loadTruckExpenses(
    organizationId,
    fleetTruckIds.map((t) => t.id),
    range,
  );
  const fleetTotals = new Map<string, number>();
  let fleetTotal = 0;
  for (const list of fleetExpenses.values()) {
    for (const expense of list) {
      fleetTotals.set(
        expense.categoryId,
        (fleetTotals.get(expense.categoryId) ?? 0) + expense.attributed,
      );
      fleetTotal += expense.attributed;
    }
  }

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const byCategory: CategoryCost[] = [...truckByCategory.entries()]
    .map(([categoryId, bucket]) => {
      const share = totalExpenses > 0 ? (bucket.amount / totalExpenses) * 100 : 0;
      const fleetShare =
        fleetTotal > 0
          ? ((fleetTotals.get(categoryId) ?? 0) / fleetTotal) * 100
          : 0;
      const kind = kindByCategory.get(categoryId) ?? null;
      return {
        categoryId,
        category: categoryNames.get(categoryId) ?? "Unknown",
        kind,
        kindLabel: costKindLabel(kind),
        amount: Math.round(bucket.amount * 100) / 100,
        count: bucket.count,
        share: Math.round(share * 10) / 10,
        fleetShare: Math.round(fleetShare * 10) / 10,
        aboveFleetAverage:
          fleetShare > 0 && share > fleetShare * ABOVE_AVERAGE_THRESHOLD,
      };
    })
    .sort((a, b) => b.amount - a.amount);

  const spendOfKind = (kind: CostKind) =>
    expenses
      .filter((e) => kindByCategory.get(e.categoryId) === kind)
      .reduce((sum, e) => sum + e.attributed, 0);

  const fuelSpend = spendOfKind("fuel");
  const maintenanceSpend = spendOfKind("maintenance");

  // ---- Month by month, so a trend is visible rather than one number ----
  const monthlyRevenue = groupByMonth(
    trips,
    (trip) => trip.endDate ?? trip.scheduledDate,
    () => 0,
    (total, trip) => total + (trip.revenue || 0),
  );
  const monthlyExpenses = groupByMonth(
    expenses,
    (expense) => expense.date,
    () => 0,
    (total, expense) => total + expense.attributed,
  );
  const monthKeys = [
    ...new Set([
      ...monthlyRevenue.map((m) => m.key),
      ...monthlyExpenses.map((m) => m.key),
    ]),
  ].sort();
  const byMonth = monthKeys.map((key) => {
    const revenueRow = monthlyRevenue.find((m) => m.key === key);
    const expenseRow = monthlyExpenses.find((m) => m.key === key);
    return {
      key,
      month: revenueRow?.month ?? expenseRow?.month ?? key,
      revenue: Math.round((revenueRow?.value ?? 0) * 100) / 100,
      expenses: Math.round((expenseRow?.value ?? 0) * 100) / 100,
    };
  });

  // ---- The fleet's own figures, to read this truck against ----
  const fleetRevenue = await prisma.trip.aggregate({
    where: earnedRevenueWhere(organizationId, range.from, range.to),
    _sum: { revenue: true },
  });
  const fleetTruckCount = fleetTruckIds.length || 1;
  const fleetProfit = (fleetRevenue._sum.revenue ?? 0) - fleetTotal;

  const fleetTrips = await prisma.trip.findMany({
    where: earnedRevenueWhere(organizationId, range.from, range.to),
    select: { actualMileage: true, estimatedMileage: true },
  });
  const fleetKm = fleetTrips.reduce(
    (sum, trip) => sum + (trip.actualMileage ?? trip.estimatedMileage ?? 0),
    0,
  );
  let fleetFuel = 0;
  for (const list of fleetExpenses.values()) {
    for (const expense of list) {
      if (kindByCategory.get(expense.categoryId) === "fuel") {
        fleetFuel += expense.attributed;
      }
    }
  }

  const round = (value: number) => Math.round(value * 100) / 100;

  return {
    revenue: round(revenue),
    expenses: round(totalExpenses),
    profit: round(revenue - totalExpenses),
    margin: revenue > 0 ? round(((revenue - totalExpenses) / revenue) * 100) : null,
    trips: revenueAgg._count,
    kilometres,
    revenuePerKm: kilometres > 0 ? round(revenue / kilometres) : null,
    costPerKm: kilometres > 0 ? round(totalExpenses / kilometres) : null,
    fuelSpend: round(fuelSpend),
    fuelPerKm: kilometres > 0 ? round(fuelSpend / kilometres) : null,
    maintenanceSpend: round(maintenanceSpend),
    downtimeDays:
      Math.round(
        maintenance.reduce((sum, job) => sum + downtimeDays(job.date, job.fixedAt), 0) *
          10,
      ) / 10,
    openJobs: maintenance.filter((job) => job.status !== "fixed").length,
    maintenanceJobs: maintenance.length,
    byCategory,
    byMonth,
    expenses_list: expenses.sort((a, b) => b.date.getTime() - a.date.getTime()),
    fleet: {
      trucks: fleetTruckCount,
      averageProfit: round(fleetProfit / fleetTruckCount),
      averageCostPerKm: fleetKm > 0 ? round(fleetTotal / fleetKm) : null,
      averageFuelPerKm: fleetKm > 0 ? round(fleetFuel / fleetKm) : null,
    },
  };
}

/** One row per truck, for the fleet-wide ranking in the report. */
export interface FleetCostRow {
  truckId: string;
  registrationNo: string;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number | null;
  kilometres: number;
  costPerKm: number | null;
  /** The category this truck over-spends on relative to the fleet, if any. */
  worstCategory: { name: string; share: number; fleetShare: number } | null;
}

export async function getFleetCostRanking(
  organizationId: string,
  range: DateRange,
): Promise<FleetCostRow[]> {
  const trucks = await prisma.truck.findMany({
    where: { organizationId },
    select: { id: true, registrationNo: true },
    orderBy: { registrationNo: "asc" },
  });
  if (trucks.length === 0) return [];

  const truckIds = trucks.map((t) => t.id);
  const [expensesByTruck, categories, trips] = await Promise.all([
    loadTruckExpenses(organizationId, truckIds, range),
    prisma.expenseCategory.findMany({
      where: { organizationId },
      select: { id: true, name: true },
    }),
    prisma.trip.findMany({
      where: earnedRevenueWhere(organizationId, range.from, range.to),
      select: {
        truckId: true,
        revenue: true,
        actualMileage: true,
        estimatedMileage: true,
      },
    }),
  ]);

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));

  // The fleet's own category split, computed once.
  const fleetTotals = new Map<string, number>();
  let fleetTotal = 0;
  for (const list of expensesByTruck.values()) {
    for (const expense of list) {
      fleetTotals.set(
        expense.categoryId,
        (fleetTotals.get(expense.categoryId) ?? 0) + expense.attributed,
      );
      fleetTotal += expense.attributed;
    }
  }

  return trucks
    .map((truck): FleetCostRow => {
      const expenses = expensesByTruck.get(truck.id) ?? [];
      const truckTrips = trips.filter((t) => t.truckId === truck.id);

      const revenue = truckTrips.reduce((sum, t) => sum + (t.revenue || 0), 0);
      const totalExpenses = expenses.reduce((sum, e) => sum + e.attributed, 0);
      const kilometres = truckTrips.reduce(
        (sum, t) => sum + (t.actualMileage ?? t.estimatedMileage ?? 0),
        0,
      );

      // Which category this truck spends disproportionately on.
      const byCategory = new Map<string, number>();
      for (const expense of expenses) {
        byCategory.set(
          expense.categoryId,
          (byCategory.get(expense.categoryId) ?? 0) + expense.attributed,
        );
      }

      let worst: FleetCostRow["worstCategory"] = null;
      let worstExcess = 0;
      for (const [categoryId, amount] of byCategory) {
        if (totalExpenses <= 0 || fleetTotal <= 0) continue;
        const share = (amount / totalExpenses) * 100;
        const fleetShare = ((fleetTotals.get(categoryId) ?? 0) / fleetTotal) * 100;
        const excess = share - fleetShare;
        if (fleetShare > 0 && excess > worstExcess) {
          worstExcess = excess;
          worst = {
            name: categoryNames.get(categoryId) ?? "Unknown",
            share: Math.round(share * 10) / 10,
            fleetShare: Math.round(fleetShare * 10) / 10,
          };
        }
      }

      const round = (value: number) => Math.round(value * 100) / 100;
      return {
        truckId: truck.id,
        registrationNo: truck.registrationNo,
        revenue: round(revenue),
        expenses: round(totalExpenses),
        profit: round(revenue - totalExpenses),
        margin: revenue > 0 ? round(((revenue - totalExpenses) / revenue) * 100) : null,
        kilometres,
        costPerKm: kilometres > 0 ? round(totalExpenses / kilometres) : null,
        worstCategory: worst,
      };
    })
    .sort((a, b) => a.profit - b.profit);
}
