/**
 * CSV for the three fleet reports.
 *
 * Numbers go out unformatted so a spreadsheet can sum and chart them; a null
 * (no distance recorded, so no cost per km) becomes an empty cell rather than
 * a dash, which Excel would read as text and refuse to average.
 */

import { buildReportCSV, type CsvReportOptions } from "@/lib/reports/csv-sections";
import type {
  DriverPerformanceReportData,
  FuelReportData,
  MaintenanceReportData,
} from "@/lib/reports/fleet-fetchers";

const n = (value: number) => value.toFixed(2);
const maybe = (value: number | null) => (value === null ? "" : value.toFixed(2));
const day = (value: Date) => value.toISOString().split("T")[0];

export function generateFuelReportCSV(
  data: FuelReportData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Fuel Report" }, [
    {
      title: "By truck",
      headers: [
        "Truck",
        "Make",
        "Model",
        "Trips",
        "Kilometres",
        "Fuel spend",
        "Fuel per km",
        "Revenue",
        "Fuel % of revenue",
        "% of fleet fuel",
      ],
      rows: data.rows.map((r) => [
        r.registrationNo,
        r.make,
        r.model,
        r.trips,
        n(r.kilometres),
        n(r.fuelSpend),
        maybe(r.fuelPerKm),
        n(r.revenue),
        maybe(r.fuelShareOfRevenue),
        n(r.shareOfFleetFuel),
      ]),
      total: [
        "Fleet",
        "",
        "",
        data.rows.reduce((s, r) => s + r.trips, 0),
        n(data.totalKilometres),
        n(data.totalFuel),
        maybe(data.fleetFuelPerKm),
        n(data.totalRevenue),
        "",
        "100.00",
      ],
      emptyMessage: "No fuel recorded in this period",
    },
    {
      title: "Fuel by month",
      headers: ["Month", "Fuel spend"],
      rows: data.monthly.map((r) => [r.month, n(r.amount)]),
      total: ["Total", n(data.totalFuel)],
      emptyMessage: "No fuel recorded in this period",
    },
  ]);
}

export function generateMaintenanceReportCSV(
  data: MaintenanceReportData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Maintenance & Downtime" }, [
    {
      title: "By vehicle",
      headers: [
        "Vehicle",
        "Type",
        "Jobs raised",
        "Fixed",
        "Still open",
        "Downtime days",
        "Average days to fix",
        "Workshop spend",
      ],
      rows: data.rows.map((r) => [
        r.vehicle,
        r.kind,
        r.raised,
        r.fixed,
        r.stillOpen,
        n(r.downtimeDays),
        maybe(r.averageFixDays),
        n(r.maintenanceSpend),
      ]),
      total: [
        "Total",
        "",
        data.raised,
        data.fixed,
        data.stillOpen,
        n(data.totalDowntimeDays),
        "",
        n(data.totalSpend),
      ],
      emptyMessage: "No workshop jobs in this period",
    },
    {
      title: "Open jobs",
      headers: ["Vehicle", "Fault", "Raised", "Age (days)", "Status", "Assigned to"],
      rows: data.openJobs.map((j) => [
        j.vehicle,
        j.notes,
        day(j.raised),
        j.ageDays,
        j.status,
        j.assignedTo ?? "",
      ]),
      emptyMessage: "Nothing open",
    },
  ]);
}

export function generateDriverPerformanceReportCSV(
  data: DriverPerformanceReportData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Driver Performance" }, [
    {
      title: "By driver",
      headers: [
        "Driver",
        "Licence",
        "Current truck",
        "Trips",
        "Kilometres",
        "Revenue",
        "Revenue per trip",
        "Driver costs",
        "Profit",
        "Margin %",
      ],
      rows: data.rows.map((r) => [
        r.driver,
        r.licenseNumber ?? "",
        r.currentTruck ?? "",
        r.trips,
        n(r.kilometres),
        n(r.revenue),
        maybe(r.revenuePerTrip),
        n(r.expenses),
        n(r.profit),
        maybe(r.margin),
      ]),
      total: [
        "Total",
        "",
        "",
        data.totals.trips,
        n(data.totals.kilometres),
        n(data.totals.revenue),
        "",
        n(data.totals.expenses),
        n(data.totals.profit),
        "",
      ],
      emptyMessage: "No driver activity in this period",
    },
  ]);
}
