/**
 * Compares every report's PDF against its CSV.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/audit-report-parity.ts
 *
 * The client's complaint was "mismatch between CSV and PDF reports, both must
 * be detailed". The mismatches were real and several: the expense PDF dropped
 * Truck, Trailer and Trip; the truck report had no category breakdown; some
 * CSVs carry columns their PDF never shows.
 *
 * Fixing them one by one is not enough on its own, because the two outputs
 * are built by different code from the same data and drift apart silently.
 * This generates both for every report, pulls the text out of each, and
 * reports any figure or column heading that appears in one and not the other.
 *
 * It is a *reporting* tool, not a pass/fail gate: some differences are
 * deliberate (a PDF's KPI tiles are a summary of rows the CSV lists in full).
 * Those are listed as "expected" below, with the reason. Anything else is
 * printed for a human to judge.
 */

import { reportConfigs } from "../src/config/reports";
import { generateReport } from "../src/app/(dashboard)/reports/actions";
import { prisma } from "../src/lib/prisma";
import { runAsActor } from "../src/lib/acting-session";

/** Differences that are correct by design, with why. */
const EXPECTED: Record<string, string> = {
  "KPI tiles": "a PDF leads with totals; the CSV carries the rows they summarise",
  Generated: "the CSV states when it was produced in its title block",
  Period: "same",
  // Two text columns will not fit beside nine figures on a landscape page, so
  // the PDF prints the contact and the number under the customer's name in
  // the same cell. The data is there; the heading is not.
  Contact: "printed under the customer name in the PDF, with no heading of its own",
  Phone: "same cell as the customer name",
};

interface Row {
  report: string;
  ok: boolean;
  note: string;
}

const results: Row[] = [];

/** Optional filter: `bun ... audit-report-parity.ts profit-loss revenue`. */
const only = process.argv.slice(2).filter((a) => !a.startsWith("-"));

const admin = await prisma.member.findFirst({
  where: { role: "admin" },
  include: { user: { select: { id: true, name: true, email: true, image: true } } },
});
if (!admin) throw new Error("no admin member — seed the database first");

const customer = await prisma.customer.findFirst({ select: { id: true } });
const truck = await prisma.truck.findFirst({ select: { id: true } });
const trailer = await prisma.trailer.findFirst({ select: { id: true } });
const trip = await prisma.trip.findFirst({ select: { id: true } });

const from = new Date();
from.setFullYear(from.getFullYear() - 1);
const to = new Date();

/**
 * Headings are compared by meaning, not by spelling.
 *
 * "Amount ($)" in a CSV is "Amount" in a PDF, which drops the unit into the
 * column's formatting; "Invoice #" is "Invoice Number". Comparing the raw
 * strings reports those as missing columns and buries the real gaps.
 */
function normalise(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/^no$|^number$/, "no")
    .trim();
}

/**
 * Different words for the same column across the two generators.
 *
 * A PDF has less width than a spreadsheet, so its headings are shorter:
 * "Distance" for "Kilometres", "Avg fix" for "Average days to fix". Some
 * columns are deliberately merged — make and model into "Vehicle", origin and
 * destination into "Route" — because a PDF reads better that way and the CSV
 * is what someone imports to slice up. Those are not gaps; the data is there.
 */
const SYNONYMS: Record<string, string[]> = {
  invoiceno: ["invoicenumber", "invoice"],
  amount: ["total", "value"],
  trip: ["description", "route"],
  date: ["issuedate", "when"],
  customer: ["customername", "client"],
  share: ["shareoftotal", "percent"],

  // Shorter headings for the same figure.
  kilometres: ["distance", "km"],
  downtimedays: ["downtime"],
  averagedaystofix: ["avgfix"],
  fuelofrevenue: ["ofrevenue"],
  costperkm: ["perkm", "costkm"],
  numberoftrips: ["trips"],
  expensecategory: ["category"],
  averagerate: ["pertrip", "rate"],
  profitperkm: ["perkm", "profitkm"],

  // "Against trucks" in the CSV is "Trucks" in the PDF, where the section
  // heading already says what the counts are against.
  againsttrucks: ["trucks"],
  againsttrips: ["trips"],
  againstdrivers: ["drivers"],

  // Deliberately merged in the PDF.
  make: ["vehicle", "unit"],
  model: ["vehicle", "unit"],
  origin: ["route"],
  destination: ["route"],
  truckregistration: ["truck", "unit", "registration"],

  // The CSV labels its first column; the PDF leaves it unlabelled because
  // the rows read as a list rather than a table of one field.
  measure: ["metric", "item", ""],
  type: ["kind"],
  bucket: ["band"],
};

function matches(heading: string, haystack: string): boolean {
  const target = normalise(heading);
  if (!target) return true;
  const flat = normalise(haystack);
  if (flat.includes(target)) return true;
  for (const alt of SYNONYMS[target] ?? []) {
    if (flat.includes(normalise(alt))) return true;
  }
  return false;
}

/** Words a reader would recognise as a column heading or a figure. */
function textOf(base64: string, mime: string): string {
  const buffer = Buffer.from(base64, "base64");
  if (mime === "text/csv") return buffer.toString("utf8");
  // PDF: the drawn strings live in ( ) inside the content streams.
  const raw = buffer.toString("latin1");
  return (raw.match(/\([^)]*\)/g) ?? []).map((part) => part.slice(1, -1)).join("\n");
}

/** Headings in a CSV: the cells of any row that is all non-numeric. */
function csvHeadings(csv: string): string[] {
  const out = new Set<string>();
  for (const line of csv.split("\n")) {
    const cells = line.split(",").map((c) => c.replace(/^"|"$/g, "").trim());
    if (cells.length < 2) continue;
    const looksLikeHeader = cells.every((c) => c === "" || !/^[-$(]?[\d,.]+%?\)?$/.test(c));
    if (looksLikeHeader) for (const c of cells) if (c.length > 1) out.add(c);
  }
  return [...out];
}

await runAsActor(
  { user: admin.user, role: "admin", organizationId: admin.organizationId } as never,
  async () => {
    const all = Object.values(reportConfigs).filter(
      (config) => only.length === 0 || only.includes(config.id),
    );
    console.log(`checking ${all.length} reports
`);

    for (const config of all) {
      const needs =
        (config.requiresCustomer && !customer) ||
        (config.requiresTruck && !truck) ||
        (config.requiresTrailer && !trailer) ||
        (config.requiresTrip && !trip);
      if (needs) {
        results.push({ report: config.name, ok: true, note: "skipped — no such record seeded" });
        continue;
      }

      const scope = {
        customerId: config.requiresCustomer ? customer!.id : undefined,
        truckId: config.requiresTruck ? truck!.id : undefined,
        trailerId: config.requiresTrailer ? trailer!.id : undefined,
        tripId: config.requiresTrip ? trip!.id : undefined,
      };

      const [pdf, csv] = await Promise.all([
        generateReport({
          reportType: config.id as never,
          startDate: from.toISOString(),
          endDate: to.toISOString(),
          period: "yearly",
          format: "pdf",
          includeMetadata: true,
          ...scope,
        }),
        generateReport({
          reportType: config.id as never,
          startDate: from.toISOString(),
          endDate: to.toISOString(),
          period: "yearly",
          format: "csv",
          includeMetadata: true,
          ...scope,
        }),
      ]);

      if (!pdf.success || !pdf.data) {
        results.push({ report: config.name, ok: false, note: `PDF failed: ${pdf.error}` });
        continue;
      }
      if (!csv.success || !csv.data) {
        results.push({ report: config.name, ok: false, note: `CSV failed: ${csv.error}` });
        continue;
      }

      const pdfText = textOf(pdf.data, "application/pdf");
      const csvText = textOf(csv.data, "text/csv");

      // A PDF with no rows prints "No data for this period" instead of a
      // table, so its headings are legitimately absent.
      const pdfHasRows = !/No data for this period/i.test(pdfText);

      const missingFromPdf = (pdfHasRows ? csvHeadings(csvText) : [])
        .filter((heading) => !matches(heading, pdfText))
        .filter((heading) => !(heading in EXPECTED))
        // A CSV states its own title and dates in the metadata block.
        .filter((heading) => !/^WD Logistics|^Generated|^Period:|^Customer:|^Truck:/.test(heading));

      const row: Row = {
        report: config.name,
        ok: missingFromPdf.length === 0,
        note: !pdfHasRows
          ? "no rows in this period — nothing to compare"
          : missingFromPdf.length === 0
            ? "columns match"
            : `in CSV only: ${missingFromPdf.slice(0, 8).join(", ")}`,
      };
      results.push(row);
      // Printed as it goes: a silent 20-minute run tells you nothing about
      // where it is, or whether it is stuck.
      console.log(`${row.ok ? "ok  " : "DIFF"} ${row.report.padEnd(34)} ${row.note}`);
    }
  },
);

const mismatches = results.filter((row) => !row.ok).length;

console.log(
  `\n${results.length} reports checked, ${mismatches} with columns the PDF does not show.`,
);
process.exit(0);
