import "server-only";

/**
 * The three fleet reports, as documents: fuel, workshop, drivers.
 *
 * Each leads with the fleet-wide figure and then ranks worst-first, because
 * the question these answer is "which of these is the problem" rather than
 * "list everything I own".
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
  DriverPerformanceReportData,
  FuelReportData,
  MaintenanceReportData,
} from "@/lib/reports/fleet-fetchers";

const pct = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;
const perKm = (value: number | null) =>
  value === null ? "—" : `${money(value)}/km`;
const km = (value: number) => `${value.toLocaleString("en-US")} km`;
const days = (value: number) => `${value.toFixed(1)}d`;

// ---------------------------------------------------------------------------

export function generateFuelReportPDF(params: {
  organization: OrganizationLike | null;
  data: FuelReportData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Fuel report",
  });

  drawHeader(ctx, { title: "Fuel Report", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Fuel spend", value: money(data.totalFuel) },
    { label: "Distance", value: km(data.totalKilometres) },
    { label: "Fleet average", value: perKm(data.fleetFuelPerKm) },
    {
      label: "Fuel as % of revenue",
      value:
        data.totalRevenue > 0
          ? pct((data.totalFuel / data.totalRevenue) * 100)
          : "—",
    },
  ]);

  drawSectionHeading(ctx, "By truck, heaviest first");
  drawTable(
    ctx,
    [
      { header: "Truck", key: "registrationNo" },
      { header: "Vehicle", key: "vehicle" },
      { header: "Trips", key: "trips", align: "right" },
      { header: "Distance", key: "kilometres", align: "right" },
      { header: "Fuel", key: "fuelSpend", align: "right" },
      { header: "Per km", key: "fuelPerKm", align: "right" },
      { header: "vs fleet", key: "vsFleet", align: "right" },
      { header: "% of revenue", key: "fuelShareOfRevenue", align: "right" },
      { header: "% of fleet fuel", key: "shareOfFleetFuel", align: "right" },
    ],
    data.rows.map((row) => ({
      registrationNo: row.registrationNo,
      vehicle: `${row.make} ${row.model}`,
      trips: row.trips,
      kilometres: km(row.kilometres),
      fuelSpend: money(row.fuelSpend),
      fuelPerKm: perKm(row.fuelPerKm),
      // The comparison that makes the row actionable: a truck 20% above the
      // fleet on fuel per km is the one to look at first.
      vsFleet:
        row.fuelPerKm !== null && data.fleetFuelPerKm
          ? `${row.fuelPerKm > data.fleetFuelPerKm ? "+" : ""}${(
              ((row.fuelPerKm - data.fleetFuelPerKm) / data.fleetFuelPerKm) *
              100
            ).toFixed(0)}%`
          : "—",
      fuelShareOfRevenue: pct(row.fuelShareOfRevenue),
      shareOfFleetFuel: pct(row.shareOfFleetFuel),
    })),
    {
      foot: [
        "Fleet",
        "",
        data.rows.reduce((s, r) => s + r.trips, 0),
        km(data.totalKilometres),
        money(data.totalFuel),
        perKm(data.fleetFuelPerKm),
        "",
        "",
        "100.0%",
      ],
      emptyMessage: "No fuel recorded against any truck in this period.",
    },
  );

  if (data.monthly.length > 0) {
    drawSectionHeading(ctx, "Fuel spend by month");
    drawTable(
      ctx,
      [
        { header: "Month", key: "month" },
        { header: "Fuel", key: "amount", align: "right" },
      ],
      data.monthly.map((row) => ({
        month: row.month,
        amount: money(row.amount),
      })),
      { foot: ["Total", money(data.totalFuel)] },
    );
  }

  drawNotes(
    ctx,
    "How fuel is identified",
    "An expense counts as fuel when its category is tagged with the fuel cost " +
      "type, not by matching the category's name — otherwise 'Diesel' would be " +
      "missed and 'Oil change' wrongly included. A fuel cost booked against " +
      "several trucks is split evenly between them, so the per-truck figures " +
      "add up to what was actually spent. Distance uses the recorded actual " +
      "mileage where there is one and the estimate otherwise.",
  );

  return finalise(ctx, { note: "Fuel Report" });
}

// ---------------------------------------------------------------------------

export function generateMaintenanceReportPDF(params: {
  organization: OrganizationLike | null;
  data: MaintenanceReportData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Maintenance and downtime",
  });

  drawHeader(ctx, { title: "Maintenance & Downtime", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Jobs raised", value: String(data.raised) },
    { label: "Fixed", value: String(data.fixed), tone: "green" },
    {
      label: "Still open",
      value: String(data.stillOpen),
      tone: data.stillOpen > 0 ? "danger" : "green",
    },
    { label: "Days off the road", value: days(data.totalDowntimeDays) },
    { label: "Workshop spend", value: money(data.totalSpend) },
  ]);

  drawSectionHeading(ctx, "By vehicle, most downtime first");
  drawTable(
    ctx,
    [
      { header: "Vehicle", key: "vehicle" },
      { header: "Type", key: "kind" },
      { header: "Raised", key: "raised", align: "right" },
      { header: "Fixed", key: "fixed", align: "right" },
      { header: "Open", key: "stillOpen", align: "right" },
      { header: "Downtime", key: "downtimeDays", align: "right" },
      { header: "Avg fix", key: "averageFixDays", align: "right" },
      { header: "Spend", key: "maintenanceSpend", align: "right" },
    ],
    data.rows.map((row) => ({
      vehicle: row.vehicle,
      kind: row.kind,
      raised: row.raised,
      fixed: row.fixed,
      stillOpen: row.stillOpen,
      downtimeDays: days(row.downtimeDays),
      averageFixDays: row.averageFixDays === null ? "—" : days(row.averageFixDays),
      maintenanceSpend: money(row.maintenanceSpend),
    })),
    {
      foot: [
        "Total",
        "",
        data.raised,
        data.fixed,
        data.stillOpen,
        days(data.totalDowntimeDays),
        "",
        money(data.totalSpend),
      ],
      emptyMessage: "No workshop jobs raised in this period.",
    },
  );

  if (data.openJobs.length > 0) {
    drawSectionHeading(ctx, "Still open, oldest first");
    drawTable(
      ctx,
      [
        { header: "Vehicle", key: "vehicle" },
        { header: "Fault", key: "notes" },
        { header: "Raised", key: "raised" },
        { header: "Age", key: "ageDays", align: "right" },
        { header: "Status", key: "status" },
        { header: "Assigned to", key: "assignedTo" },
      ],
      data.openJobs.map((job) => ({
        vehicle: job.vehicle,
        notes: job.notes.length > 70 ? `${job.notes.slice(0, 67)}...` : job.notes,
        raised: shortDate(job.raised),
        ageDays: `${job.ageDays}d`,
        status: job.status,
        assignedTo: job.assignedTo ?? "Nobody yet",
      })),
    );
  }

  drawNotes(
    ctx,
    "How downtime is counted",
    "A vehicle is counted as off the road from the day a job is raised until " +
      "the day it is marked fixed; a job still open counts up to today, which " +
      "is why an old open job dominates this table. That is the same rule the " +
      "truck cost breakdown uses, so the two agree.",
  );

  return finalise(ctx, { note: "Maintenance & Downtime" });
}

// ---------------------------------------------------------------------------

export function generateDriverPerformanceReportPDF(params: {
  organization: OrganizationLike | null;
  data: DriverPerformanceReportData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Driver performance",
  });

  drawHeader(ctx, { title: "Driver Performance", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Drivers with activity", value: String(data.rows.length) },
    { label: "Trips completed", value: String(data.totals.trips) },
    { label: "Revenue earned", value: money(data.totals.revenue) },
    {
      label: "Profit after driver costs",
      value: money(data.totals.profit),
      tone: data.totals.profit >= 0 ? "green" : "danger",
    },
  ]);

  drawSectionHeading(ctx, "By revenue earned");
  drawTable(
    ctx,
    [
      { header: "Driver", key: "driver" },
      { header: "Current truck", key: "currentTruck" },
      { header: "Trips", key: "trips", align: "right" },
      { header: "Distance", key: "kilometres", align: "right" },
      { header: "Revenue", key: "revenue", align: "right" },
      { header: "Per trip", key: "revenuePerTrip", align: "right" },
      { header: "Driver costs", key: "expenses", align: "right" },
      { header: "Profit", key: "profit", align: "right" },
      { header: "Margin", key: "margin", align: "right" },
    ],
    data.rows.map((row) => ({
      driver: row.driver,
      currentTruck: row.currentTruck ?? "Unassigned",
      trips: row.trips,
      kilometres: km(row.kilometres),
      revenue: money(row.revenue),
      revenuePerTrip:
        row.revenuePerTrip === null ? "—" : money(row.revenuePerTrip),
      expenses: money(row.expenses),
      profit: money(row.profit),
      margin: pct(row.margin),
    })),
    {
      foot: [
        "Total",
        "",
        data.totals.trips,
        km(data.totals.kilometres),
        money(data.totals.revenue),
        "",
        money(data.totals.expenses),
        money(data.totals.profit),
        "",
      ],
      emptyMessage: "No driver activity in this period.",
    },
  );

  drawNotes(
    ctx,
    "What these figures cover",
    "Revenue is the driver's completed trips in the period. Driver costs are " +
      "expenses booked directly against that driver — allowances and the like " +
      "— not the truck's running costs, so this is not a full profit figure " +
      "per driver. For revenue and cost split per truck a driver worked, use " +
      "the driver's own page, which reads the assignment history.",
  );

  return finalise(ctx, { note: "Driver Performance" });
}
