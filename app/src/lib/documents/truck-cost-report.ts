import "server-only";

/**
 * The truck cost breakdown, as a document.
 *
 * Item 1 asked for the on-screen breakdown *and* "a separate report for
 * this". Same figures, same allocation rules — it reads from
 * lib/metrics/truck-costs.ts rather than recomputing, so the PDF and the page
 * can never disagree.
 *
 * Covers one truck or the whole fleet. The fleet version leads with a ranking
 * worst-profit-first, because the question it answers is "which of these is
 * the problem".
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
  finalise,
  money,
  shortDate,
  type OrganizationLike,
} from "@/lib/documents/kit";
import type {
  FleetCostRow,
  TruckCostBreakdown,
} from "@/lib/metrics/truck-costs";

const ALLOCATION_NOTE =
  "A cost shared between several trucks is split evenly between them, so the " +
  "per-truck figures add up to what the company actually spent. A cost entered " +
  "against both a truck and one of its own trips is counted once. Revenue " +
  "counts completed trips only, dated by when the trip ended.";

export interface TruckCostReportData {
  organization: OrganizationLike | null;
  period: { from: Date; to: Date };
  /** Present for a single-truck report. */
  truck?: {
    registrationNo: string;
    make: string;
    model: string;
    year: number;
    breakdown: TruckCostBreakdown;
  };
  /** Present for the fleet-wide report. */
  fleet?: FleetCostRow[];
}

export function generateTruckCostReportPDF(
  data: TruckCostReportData,
): Uint8Array {
  const ctx = createDocument({
    organization: data.organization,
    title: data.truck
      ? `Truck cost breakdown — ${data.truck.registrationNo}`
      : "Fleet cost breakdown",
  });

  drawHeader(ctx, {
    title: "Cost Breakdown",
    docNo: data.truck?.registrationNo,
    metaLines: data.truck
      ? [`${data.truck.make} ${data.truck.model} (${data.truck.year})`]
      : ["All trucks"],
  });

  drawPeriodLine(
    ctx,
    `Period: ${dateRangeLabel(data.period.from, data.period.to)}`,
  );

  if (data.truck) {
    renderSingleTruck(ctx, data.truck);
  }

  if (data.fleet) {
    renderFleet(ctx, data.fleet);
  }

  drawNotes(ctx, "How these figures are worked out", ALLOCATION_NOTE);

  return finalise(ctx, {
    docNo: data.truck
      ? `Cost breakdown · ${data.truck.registrationNo}`
      : "Fleet cost breakdown",
  });
}

type Ctx = ReturnType<typeof createDocument>;

function renderSingleTruck(
  ctx: Ctx,
  truck: NonNullable<TruckCostReportData["truck"]>,
): void {
  const b = truck.breakdown;

  drawKpiRow(ctx, [
    { label: "Revenue", value: money(b.revenue), tone: "green" },
    { label: "Costs", value: money(b.expenses) },
    {
      label: b.profit < 0 ? "Loss" : "Profit",
      value: money(Math.abs(b.profit)),
      tone: b.profit < 0 ? "danger" : "green",
    },
    { label: "Margin", value: b.margin === null ? "—" : `${b.margin}%` },
  ]);

  drawKpiRow(ctx, [
    { label: "Trips", value: String(b.trips) },
    { label: "Kilometres", value: b.kilometres.toLocaleString() },
    {
      label: "Cost / km",
      value: b.costPerKm === null ? "—" : money(b.costPerKm),
      tone:
        b.costPerKm !== null &&
        b.fleet.averageCostPerKm !== null &&
        b.costPerKm > b.fleet.averageCostPerKm * 1.2
          ? "danger"
          : undefined,
    },
    {
      label: "Fuel / km",
      value: b.fuelPerKm === null ? "—" : money(b.fuelPerKm),
      tone:
        b.fuelPerKm !== null &&
        b.fleet.averageFuelPerKm !== null &&
        b.fuelPerKm > b.fleet.averageFuelPerKm * 1.2
          ? "danger"
          : undefined,
    },
  ]);

  // ---- Where the money went ----
  drawTable(
    ctx,
    [
      { header: "Category", key: "category" },
      { header: "Type", key: "kind" },
      { header: "Count", key: "count", align: "right", width: 18 },
      { header: "Amount", key: "amount", align: "right", width: 28 },
      { header: "Share", key: "share", align: "right", width: 20 },
      { header: "Fleet", key: "fleetShare", align: "right", width: 20 },
    ],
    b.byCategory.map((category) => ({
      category:
        category.category + (category.aboveFleetAverage ? "  (above fleet)" : ""),
      kind: category.kindLabel,
      count: category.count,
      amount: money(category.amount),
      share: `${category.share}%`,
      fleetShare: `${category.fleetShare}%`,
    })),
    {
      title: "Costs by category",
      foot: ["Total", "", b.byCategory.reduce((s, c) => s + c.count, 0), money(b.expenses), "100%", ""],
      emptyMessage: "No costs recorded against this truck in the period.",
    },
  );

  // ---- Fuel and workshop, the two questions the client named ----
  drawSectionHeading(ctx, "Fuel economics and downtime");
  drawTable(
    ctx,
    [
      { header: "Measure", key: "label" },
      { header: "This truck", key: "value", align: "right", width: 40 },
      { header: "Fleet", key: "fleet", align: "right", width: 40 },
    ],
    [
      {
        label: "Fuel spend",
        value: money(b.fuelSpend),
        fleet: "—",
      },
      {
        label: "Fuel per kilometre",
        value: b.fuelPerKm === null ? "—" : money(b.fuelPerKm),
        fleet:
          b.fleet.averageFuelPerKm === null
            ? "—"
            : money(b.fleet.averageFuelPerKm),
      },
      {
        label: "Cost per kilometre",
        value: b.costPerKm === null ? "—" : money(b.costPerKm),
        fleet:
          b.fleet.averageCostPerKm === null
            ? "—"
            : money(b.fleet.averageCostPerKm),
      },
      { label: "Workshop spend", value: money(b.maintenanceSpend), fleet: "—" },
      { label: "Jobs raised", value: String(b.maintenanceJobs), fleet: "—" },
      { label: "Still open", value: String(b.openJobs), fleet: "—" },
      { label: "Days out of service", value: String(b.downtimeDays), fleet: "—" },
      {
        label: "Profit",
        value: money(b.profit),
        fleet: money(b.fleet.averageProfit),
      },
    ],
  );

  // ---- Month by month, so a trend shows ----
  drawTable(
    ctx,
    [
      { header: "Month", key: "month" },
      { header: "Revenue", key: "revenue", align: "right", width: 30 },
      { header: "Costs", key: "expenses", align: "right", width: 30 },
      { header: "Profit", key: "profit", align: "right", width: 30 },
    ],
    b.byMonth.map((row) => ({
      month: row.month,
      revenue: money(row.revenue),
      expenses: money(row.expenses),
      profit: money(row.revenue - row.expenses),
    })),
    { title: "Month by month", emptyMessage: "Nothing recorded in this period." },
  );

  // ---- The ten biggest costs, which is usually where the answer is ----
  const top = [...b.expenses_list]
    .sort((a, b2) => b2.attributed - a.attributed)
    .slice(0, 10);

  drawTable(
    ctx,
    [
      { header: "Date", key: "date", width: 26 },
      { header: "Description", key: "description" },
      { header: "Category", key: "category", width: 34 },
      { header: "Amount", key: "amount", align: "right", width: 28 },
    ],
    top.map((expense) => ({
      date: shortDate(expense.date),
      description:
        expense.description +
        (expense.source === "trip" && expense.tripLabel
          ? `  (${expense.tripLabel})`
          : "") +
        (expense.sharedWith > 1 ? `  [shared ${expense.sharedWith} ways]` : ""),
      category: expense.category,
      amount: money(expense.attributed),
    })),
    { title: "Ten biggest costs", emptyMessage: "No costs in this period." },
  );
}

function renderFleet(ctx: Ctx, rows: FleetCostRow[]): void {
  const totals = rows.reduce(
    (acc, row) => ({
      revenue: acc.revenue + row.revenue,
      expenses: acc.expenses + row.expenses,
      profit: acc.profit + row.profit,
      kilometres: acc.kilometres + row.kilometres,
    }),
    { revenue: 0, expenses: 0, profit: 0, kilometres: 0 },
  );

  drawKpiRow(ctx, [
    { label: "Trucks", value: String(rows.length) },
    { label: "Revenue", value: money(totals.revenue), tone: "green" },
    { label: "Costs", value: money(totals.expenses) },
    {
      label: totals.profit < 0 ? "Loss" : "Profit",
      value: money(Math.abs(totals.profit)),
      tone: totals.profit < 0 ? "danger" : "green",
    },
  ]);

  drawTable(
    ctx,
    [
      { header: "Truck", key: "truck", width: 26 },
      { header: "Revenue", key: "revenue", align: "right", width: 28 },
      { header: "Costs", key: "expenses", align: "right", width: 28 },
      { header: "Profit", key: "profit", align: "right", width: 28 },
      { header: "Margin", key: "margin", align: "right", width: 20 },
      { header: "Cost/km", key: "costPerKm", align: "right", width: 22 },
      { header: "Worst category", key: "worst" },
    ],
    rows.map((row) => ({
      truck: row.registrationNo,
      revenue: money(row.revenue),
      expenses: money(row.expenses),
      profit: money(row.profit),
      margin: row.margin === null ? "—" : `${row.margin}%`,
      costPerKm: row.costPerKm === null ? "—" : money(row.costPerKm),
      worst: row.worstCategory
        ? `${row.worstCategory.name} ${row.worstCategory.share}% vs ${row.worstCategory.fleetShare}%`
        : "—",
    })),
    {
      // Worst profit first: the question this answers is which truck is the
      // problem, so the problem goes at the top.
      title: "Every truck, worst profit first",
      foot: [
        "Fleet",
        money(totals.revenue),
        money(totals.expenses),
        money(totals.profit),
        totals.revenue > 0
          ? `${Math.round((totals.profit / totals.revenue) * 1000) / 10}%`
          : "—",
        totals.kilometres > 0
          ? money(totals.expenses / totals.kilometres)
          : "—",
        "",
      ],
      emptyMessage: "No trucks on record.",
    },
  );
}
