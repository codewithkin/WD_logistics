/**
 * CSV for the remaining five reports.
 *
 * Dates go out as ISO so they sort; nulls go out empty rather than as a dash,
 * so a spreadsheet can still average the column.
 */

import { buildReportCSV, type CsvReportOptions } from "@/lib/reports/csv-sections";
import type {
  CustomerProfitabilityData,
  DocumentExpiryReportData,
  ExpenseCategoryReportData,
  InventoryValuationData,
  TripPnLData,
} from "@/lib/reports/operations-fetchers";

const n = (value: number) => value.toFixed(2);
const maybe = (value: number | null) => (value === null ? "" : value.toFixed(2));
const day = (value: Date) => value.toISOString().split("T")[0];

export function generateCustomerProfitabilityCSV(
  data: CustomerProfitabilityData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Customer Profitability" }, [
    {
      title: "By customer",
      headers: [
        "Customer",
        "Contact",
        "Phone",
        "Trips",
        "Kilometres",
        "Revenue",
        "Average rate",
        "Rate per km",
        "Trip costs",
        "Profit",
        "Margin %",
        "Invoiced",
        "Outstanding",
        "% of revenue",
      ],
      rows: data.rows.map((r) => [
        r.customer,
        r.contact ?? "",
        r.phone ?? "",
        r.trips,
        n(r.kilometres),
        n(r.revenue),
        maybe(r.averageRate),
        maybe(r.ratePerKm),
        n(r.tripCosts),
        n(r.profit),
        maybe(r.margin),
        n(r.invoiced),
        n(r.outstanding),
        n(r.shareOfRevenue),
      ]),
      total: [
        "Total",
        "",
        "",
        data.totals.trips,
        "",
        n(data.totals.revenue),
        "",
        "",
        n(data.totals.tripCosts),
        n(data.totals.profit),
        "",
        "",
        n(data.totals.outstanding),
        "100.00",
      ],
      emptyMessage: "No customer activity in this period",
    },
  ]);
}

export function generateExpenseCategoryReportCSV(
  data: ExpenseCategoryReportData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Expenses by Category" }, [
    {
      title: "By category",
      headers: [
        "Category",
        "Cost type",
        "Account",
        "Entries",
        "Total",
        "Average",
        "Largest",
        "Share %",
        "Against trucks",
        "Against trips",
        "Against drivers",
        "Overheads",
      ],
      rows: data.rows.map((r) => [
        r.category,
        r.kind,
        r.account ?? "",
        r.entries,
        n(r.total),
        n(r.average),
        n(r.largest),
        n(r.share),
        r.againstTrucks,
        r.againstTrips,
        r.againstDrivers,
        r.overheads,
      ]),
      total: ["Total", "", "", data.entries, n(data.total), "", "", "100.00", "", "", "", ""],
      emptyMessage: "No expenses recorded in this period",
    },
    {
      title: "By cost type",
      headers: ["Cost type", "Total", "Share %"],
      rows: data.byKind.map((r) => [r.kind, n(r.total), n(r.share)]),
      emptyMessage: "Nothing to group",
    },
    {
      title: "By month",
      headers: ["Month", "Total"],
      rows: data.monthly.map((r) => [r.month, n(r.total)]),
      total: ["Total", n(data.total)],
      emptyMessage: "No expenses recorded in this period",
    },
  ]);
}

export function generateDocumentExpiryReportCSV(
  data: DocumentExpiryReportData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Document Expiry" }, [
    {
      title: `Expiring within ${data.withinDays} days`,
      headers: [
        "Type",
        "Truck / person",
        "Document",
        "Expires on",
        "Days remaining",
        "Expired",
      ],
      rows: data.rows.map((r) => [
        r.entity,
        r.subject,
        r.document,
        day(r.expiresOn),
        r.daysRemaining,
        r.expired ? "yes" : "no",
      ]),
      emptyMessage: `Nothing expires in the next ${data.withinDays} days`,
    },
    {
      title: "No expiry date on record",
      headers: ["Type", "Truck / person", "Document"],
      rows: data.missing.map((r) => [r.entity, r.subject, r.document]),
      emptyMessage: "Every document has a date",
    },
  ]);
}

export function generateInventoryValuationCSV(
  data: InventoryValuationData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Inventory Valuation" }, [
    {
      title: "Holdings",
      headers: [
        "Item",
        "SKU",
        "Category",
        "Unit",
        "Quantity",
        "Minimum",
        "Unit cost",
        "Value",
        "Below minimum",
        "Location",
      ],
      rows: data.rows.map((r) => [
        r.name,
        r.sku ?? "",
        r.category ?? "",
        r.unit ?? "",
        r.quantity,
        r.minQuantity,
        maybe(r.unitCost),
        n(r.value),
        r.belowMinimum ? "yes" : "no",
        r.location ?? "",
      ]),
      total: ["Total", "", "", "", "", "", "", n(data.totalValue), "", ""],
      emptyMessage: "No inventory items on record",
    },
    {
      title: "Movements",
      headers: ["Date", "Item", "Type", "Quantity", "Value", "Where", "Why"],
      rows: data.movements.map((r) => [
        day(r.date),
        r.item,
        r.type,
        r.quantity,
        maybe(r.value),
        r.destination ?? "",
        r.reason ?? "",
      ]),
      total: [
        "Total",
        "",
        `in ${data.movementTotals.in} / out ${data.movementTotals.out}`,
        "",
        `${n(data.movementTotals.inValue)} / ${n(data.movementTotals.outValue)}`,
        "",
        "",
      ],
      emptyMessage: "No stock moved in this period",
    },
  ]);
}

export function generateTripPnLCSV(
  data: TripPnLData,
  options: Omit<CsvReportOptions, "title">,
): string {
  return buildReportCSV({ ...options, title: "Trip Profit & Loss" }, [
    {
      title: "Every trip",
      headers: [
        "Date",
        "Route",
        "Truck",
        "Driver",
        "Customer",
        "Status",
        "Kilometres",
        "Revenue",
        "Costs",
        "Profit",
        "Margin %",
        "Profit per km",
      ],
      rows: data.rows.map((r) => [
        day(r.date),
        r.route,
        r.truck,
        r.driver,
        r.customer,
        r.status,
        r.kilometres,
        n(r.revenue),
        n(r.expenses),
        n(r.profit),
        maybe(r.margin),
        maybe(r.profitPerKm),
      ]),
      total: [
        "Total",
        "",
        "",
        "",
        "",
        "",
        n(data.totals.kilometres),
        n(data.totals.revenue),
        n(data.totals.expenses),
        n(data.totals.profit),
        maybe(data.totals.margin),
        "",
      ],
      emptyMessage: "No completed trips in this period",
    },
  ]);
}
