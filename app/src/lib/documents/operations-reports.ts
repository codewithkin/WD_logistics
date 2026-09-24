import "server-only";

/**
 * The remaining five reports, as documents.
 *
 * Document expiry is the one to read first on any given morning: it is the
 * only report here where the consequence of ignoring it is a truck stopped at
 * a border, so it leads with what has already expired rather than with a
 * total.
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
  CustomerProfitabilityData,
  DocumentExpiryReportData,
  ExpenseCategoryReportData,
  InventoryValuationData,
  TripPnLData,
} from "@/lib/reports/operations-fetchers";

const pct = (value: number | null) =>
  value === null ? "—" : `${value.toFixed(1)}%`;
const km = (value: number) => `${value.toLocaleString("en-US")} km`;
const maybeMoney = (value: number | null) =>
  value === null ? "—" : money(value);

// ---------------------------------------------------------------------------

export function generateCustomerProfitabilityPDF(params: {
  organization: OrganizationLike | null;
  data: CustomerProfitabilityData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Customer profitability",
  });

  drawHeader(ctx, { title: "Customer Profitability", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Customers", value: String(data.rows.length) },
    { label: "Revenue", value: money(data.totals.revenue) },
    {
      label: "Profit after trip costs",
      value: money(data.totals.profit),
      tone: data.totals.profit >= 0 ? "green" : "danger",
    },
    {
      label: "Still outstanding",
      value: money(data.totals.outstanding),
      tone: data.totals.outstanding > 0 ? "danger" : "green",
    },
  ]);

  drawSectionHeading(ctx, "By revenue");
  drawTable(
    ctx,
    [
      { header: "Customer", key: "customer" },
      { header: "Trips", key: "trips", align: "right" },
      { header: "Revenue", key: "revenue", align: "right" },
      { header: "Avg rate", key: "averageRate", align: "right" },
      { header: "Per km", key: "ratePerKm", align: "right" },
      { header: "Trip costs", key: "tripCosts", align: "right" },
      { header: "Profit", key: "profit", align: "right" },
      { header: "Margin", key: "margin", align: "right" },
      { header: "Outstanding", key: "outstanding", align: "right" },
      { header: "% of revenue", key: "shareOfRevenue", align: "right" },
    ],
    data.rows.map((row) => ({
      customer: row.customer,
      trips: row.trips,
      revenue: money(row.revenue),
      averageRate: maybeMoney(row.averageRate),
      ratePerKm: maybeMoney(row.ratePerKm),
      tripCosts: money(row.tripCosts),
      profit: money(row.profit),
      margin: pct(row.margin),
      outstanding: money(row.outstanding),
      shareOfRevenue: pct(row.shareOfRevenue),
    })),
    {
      foot: [
        "Total",
        data.totals.trips,
        money(data.totals.revenue),
        "",
        "",
        money(data.totals.tripCosts),
        money(data.totals.profit),
        "",
        money(data.totals.outstanding),
        "100.0%",
      ],
      emptyMessage: "No customer activity in this period.",
    },
  );

  drawNotes(
    ctx,
    "What profit means here",
    "Profit is revenue less the costs booked against that customer's trips. " +
      "It does not carry a share of the truck's standing costs or of company " +
      "overheads, so it is a contribution figure rather than a full net " +
      "profit. Outstanding is the balance on invoices raised in this period.",
  );

  return finalise(ctx, { note: "Customer Profitability" });
}

// ---------------------------------------------------------------------------

export function generateExpenseCategoryReportPDF(params: {
  organization: OrganizationLike | null;
  data: ExpenseCategoryReportData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Expense categories",
  });

  drawHeader(ctx, { title: "Expenses by Category", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Total spend", value: money(data.total) },
    { label: "Entries", value: String(data.entries) },
    { label: "Categories used", value: String(data.rows.length) },
    {
      label: "Largest category",
      value: data.rows[0]?.category ?? "—",
    },
  ]);

  drawSectionHeading(ctx, "By category");
  drawTable(
    ctx,
    [
      { header: "Category", key: "category" },
      { header: "Type", key: "kind" },
      { header: "Account", key: "account" },
      { header: "Entries", key: "entries", align: "right" },
      { header: "Total", key: "total", align: "right" },
      { header: "Average", key: "average", align: "right" },
      { header: "Largest", key: "largest", align: "right" },
      { header: "Share", key: "share", align: "right" },
    ],
    data.rows.map((row) => ({
      category: row.category,
      kind: row.kind,
      account: row.account ?? "—",
      entries: row.entries,
      total: money(row.total),
      average: money(row.average),
      largest: money(row.largest),
      share: pct(row.share),
    })),
    {
      foot: [
        "Total",
        "",
        "",
        data.entries,
        money(data.total),
        "",
        "",
        "100.0%",
      ],
      emptyMessage: "No expenses recorded in this period.",
    },
  );

  drawSectionHeading(ctx, "By cost type");
  drawTable(
    ctx,
    [
      { header: "Type", key: "kind" },
      { header: "Total", key: "total", align: "right" },
      { header: "Share", key: "share", align: "right" },
    ],
    data.byKind.map((row) => ({
      kind: row.kind,
      total: money(row.total),
      share: pct(row.share),
    })),
    { emptyMessage: "Nothing to group." },
  );

  if (data.monthly.length > 0) {
    drawSectionHeading(ctx, "By month");
    drawTable(
      ctx,
      [
        { header: "Month", key: "month" },
        { header: "Total", key: "total", align: "right" },
      ],
      data.monthly.map((row) => ({
        month: row.month,
        total: money(row.total),
      })),
      { foot: ["Total", money(data.total)] },
    );
  }

  drawNotes(
    ctx,
    "Where the money was booked",
    "Every expense in the period is counted once, at its full value, against " +
      "the category it was filed under. An expense whose category has since " +
      "been deleted is shown as 'Uncategorised' rather than dropped, so the " +
      "rows always re-sum to the total.",
  );

  return finalise(ctx, { note: "Expenses by Category" });
}

// ---------------------------------------------------------------------------

export function generateDocumentExpiryReportPDF(params: {
  organization: OrganizationLike | null;
  data: DocumentExpiryReportData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    title: "Document expiry",
  });

  drawHeader(ctx, { title: "Document Expiry", date: data.asOf });
  drawPeriodLine(
    ctx,
    `Expired, or expiring within ${data.withinDays} days of ${shortDate(data.asOf)}`,
  );

  drawKpiRow(ctx, [
    {
      label: "Already expired",
      value: String(data.expired),
      tone: data.expired > 0 ? "danger" : "green",
    },
    { label: "Expiring soon", value: String(data.dueSoon) },
    {
      label: "No date recorded",
      value: String(data.missing.length),
      tone: data.missing.length > 0 ? "danger" : "green",
    },
  ]);

  drawSectionHeading(ctx, "Soonest first");
  drawTable(
    ctx,
    [
      { header: "Type", key: "entity" },
      { header: "Truck / person", key: "subject" },
      { header: "Document", key: "document" },
      { header: "Expires", key: "expiresOn" },
      { header: "Days", key: "daysRemaining", align: "right" },
    ],
    data.rows.map((row) => ({
      entity: row.entity,
      subject: row.subject,
      document: row.document,
      expiresOn: shortDate(row.expiresOn),
      // Negative days read badly; "12 days ago" says what it means.
      daysRemaining: row.expired
        ? `${Math.abs(row.daysRemaining)}d ago`
        : `${row.daysRemaining}d`,
    })),
    {
      emptyMessage: `Nothing expires in the next ${data.withinDays} days.`,
    },
  );

  if (data.missing.length > 0) {
    drawSectionHeading(ctx, "No expiry date on record");
    drawTable(
      ctx,
      [
        { header: "Type", key: "entity" },
        { header: "Truck / person", key: "subject" },
        { header: "Document", key: "document" },
      ],
      data.missing.map((row) => ({
        entity: row.entity,
        subject: row.subject,
        document: row.document,
      })),
    );
  }

  drawNotes(
    ctx,
    "Why the blank ones matter",
    "A document with no expiry date recorded is not safe — it is simply not " +
      "being watched, and it will never trigger a reminder. The second table " +
      "is the list of things nobody would be warned about.",
  );

  return finalise(ctx, { note: "Document Expiry" });
}

// ---------------------------------------------------------------------------

export function generateInventoryValuationPDF(params: {
  organization: OrganizationLike | null;
  data: InventoryValuationData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Inventory valuation",
  });

  drawHeader(ctx, { title: "Inventory Valuation", date: data.asOf });
  drawPeriodLine(
    ctx,
    `Holdings as at ${shortDate(data.asOf)} · movements ${dateRangeLabel(data.from, data.to)}`,
  );

  drawKpiRow(ctx, [
    { label: "Stock value", value: money(data.totalValue) },
    { label: "Items", value: String(data.itemCount) },
    {
      label: "At or below minimum",
      value: String(data.belowMinimum),
      tone: data.belowMinimum > 0 ? "danger" : "green",
    },
    {
      label: "No cost recorded",
      value: String(data.unpriced),
      tone: data.unpriced > 0 ? "danger" : "green",
    },
  ]);

  drawSectionHeading(ctx, "By value");
  drawTable(
    ctx,
    [
      { header: "Item", key: "name" },
      { header: "SKU", key: "sku" },
      { header: "Category", key: "category" },
      { header: "Qty", key: "quantity", align: "right" },
      { header: "Min", key: "minQuantity", align: "right" },
      { header: "Unit cost", key: "unitCost", align: "right" },
      { header: "Value", key: "value", align: "right" },
      { header: "Location", key: "location" },
    ],
    data.rows.map((row) => ({
      name: row.belowMinimum ? `${row.name}  (low)` : row.name,
      sku: row.sku ?? "—",
      category: row.category ?? "—",
      quantity: `${row.quantity}${row.unit ? ` ${row.unit}` : ""}`,
      minQuantity: row.minQuantity,
      unitCost: maybeMoney(row.unitCost),
      value: money(row.value),
      location: row.location ?? "—",
    })),
    {
      foot: ["Total", "", "", "", "", "", money(data.totalValue), ""],
      emptyMessage: "No inventory items on record.",
    },
  );

  drawSectionHeading(ctx, "Movements in the period");
  drawTable(
    ctx,
    [
      { header: "Date", key: "date" },
      { header: "Item", key: "item" },
      { header: "In / out", key: "type" },
      { header: "Qty", key: "quantity", align: "right" },
      { header: "Value", key: "value", align: "right" },
      { header: "Where", key: "destination" },
      { header: "Why", key: "reason" },
    ],
    data.movements.map((row) => ({
      date: shortDate(row.date),
      item: row.item,
      type: row.type,
      quantity: row.quantity,
      value: maybeMoney(row.value),
      destination: row.destination ?? "—",
      reason: row.reason
        ? row.reason.length > 50
          ? `${row.reason.slice(0, 47)}...`
          : row.reason
        : "—",
    })),
    {
      foot: [
        "Total",
        "",
        `in ${data.movementTotals.in} / out ${data.movementTotals.out}`,
        "",
        `${money(data.movementTotals.inValue)} / ${money(data.movementTotals.outValue)}`,
        "",
        "",
      ],
      emptyMessage: "No stock moved in this period.",
    },
  );

  drawNotes(
    ctx,
    "How stock is valued",
    "Each item is valued at quantity times its current unit cost. An item " +
      "with no unit cost recorded values at nothing and is counted separately " +
      "above, because it would otherwise quietly understate the total. A " +
      "movement is valued at the cost held when it happened, so repricing an " +
      "item does not rewrite its history.",
  );

  return finalise(ctx, { note: "Inventory Valuation" });
}

// ---------------------------------------------------------------------------

export function generateTripPnLPDF(params: {
  organization: OrganizationLike | null;
  data: TripPnLData;
}): Uint8Array {
  const { data } = params;
  const ctx = createDocument({
    organization: params.organization,
    orientation: "landscape",
    title: "Trip profit and loss",
  });

  drawHeader(ctx, { title: "Trip Profit & Loss", date: new Date() });
  drawPeriodLine(ctx, `Period: ${dateRangeLabel(data.from, data.to)}`);

  drawKpiRow(ctx, [
    { label: "Trips", value: String(data.totals.trips) },
    { label: "Revenue", value: money(data.totals.revenue) },
    { label: "Trip costs", value: money(data.totals.expenses) },
    {
      label: "Profit",
      value: money(data.totals.profit),
      tone: data.totals.profit >= 0 ? "green" : "danger",
    },
    { label: "Margin", value: pct(data.totals.margin) },
  ]);

  if (data.worst.length > 0 && data.rows.length > 5) {
    drawSectionHeading(ctx, "Thinnest trips — where the money went");
    drawTable(
      ctx,
      [
        { header: "Date", key: "date" },
        { header: "Route", key: "route" },
        { header: "Truck", key: "truck" },
        { header: "Revenue", key: "revenue", align: "right" },
        { header: "Costs", key: "expenses", align: "right" },
        { header: "Profit", key: "profit", align: "right" },
        { header: "Margin", key: "margin", align: "right" },
      ],
      data.worst.map((row) => ({
        date: shortDate(row.date),
        route: row.route,
        truck: row.truck,
        revenue: money(row.revenue),
        expenses: money(row.expenses),
        profit: money(row.profit),
        margin: pct(row.margin),
      })),
    );
  }

  drawSectionHeading(ctx, "Every trip");
  drawTable(
    ctx,
    [
      { header: "Date", key: "date" },
      { header: "Route", key: "route" },
      { header: "Truck", key: "truck" },
      { header: "Driver", key: "driver" },
      { header: "Customer", key: "customer" },
      { header: "Distance", key: "kilometres", align: "right" },
      { header: "Revenue", key: "revenue", align: "right" },
      { header: "Costs", key: "expenses", align: "right" },
      { header: "Profit", key: "profit", align: "right" },
      { header: "Margin", key: "margin", align: "right" },
    ],
    data.rows.map((row) => ({
      date: shortDate(row.date),
      route: row.route,
      truck: row.truck,
      driver: row.driver,
      customer: row.customer,
      kilometres: km(row.kilometres),
      revenue: money(row.revenue),
      expenses: money(row.expenses),
      profit: money(row.profit),
      margin: pct(row.margin),
    })),
    {
      foot: [
        "Total",
        "",
        "",
        "",
        "",
        km(data.totals.kilometres),
        money(data.totals.revenue),
        money(data.totals.expenses),
        money(data.totals.profit),
        pct(data.totals.margin),
      ],
      emptyMessage: "No completed trips in this period.",
    },
  );

  drawNotes(
    ctx,
    "What a trip's costs include",
    "Costs are the expenses booked against that trip, whatever date they " +
      "carry — a fuel bill settled after the trip ended is still that trip's " +
      "cost. A cost shared between several trips is split evenly between " +
      "them. Standing truck costs and company overheads are not apportioned " +
      "here, so this is contribution per trip rather than full net profit.",
  );

  return finalise(ctx, { note: "Trip Profit & Loss" });
}
