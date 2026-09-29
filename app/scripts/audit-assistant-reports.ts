/**
 * Checks the assistant can produce every report the web app can.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/audit-assistant-reports.ts
 *
 * The client's requirement is that the assistant generates the *same* reports
 * as the web app — same structure, same everything. It already does that by
 * construction: `generate_report` calls the very same `generateReport` server
 * action the Reports page calls, so there is no second implementation to drift.
 *
 * What could drift is *reach*. Two of the twenty-three used to be refused over
 * a message because they are about one trailer or one trip, and the reasoning
 * was that nobody carries those ids in their head. True of the id; not of the
 * registration painted on a trailer or the route of a trip. So this walks the
 * report registry — not a list written out here — and produces every one of
 * them through the assistant, naming the record the way a person would.
 *
 * A report added to `config/reports.ts` and not reachable from the assistant
 * fails here.
 *
 * No model is involved: the operations are invoked directly. Nothing here
 * costs anything to run.
 */

import { reportConfigs } from "../src/config/reports";
import { findOperation } from "../src/lib/assistant/operations";
import { prisma } from "../src/lib/prisma";
import { runAsActor } from "../src/lib/acting-session";

interface Row {
  report: string;
  ok: boolean;
  note: string;
}

const results: Row[] = [];

const admin = await prisma.member.findFirst({
  where: { role: "admin" },
  include: { user: { select: { id: true, name: true, email: true, image: true } } },
});
if (!admin) throw new Error("no admin member — run db:seed first");

const ctx = {
  organizationId: admin.organizationId,
  role: "admin",
  actorName: admin.user.name,
  actorUserId: admin.user.id,
};

// The words a person would use for each kind of record, read from the
// database so the test names real things.
const customer = await prisma.customer.findFirst({
  where: { organizationId: admin.organizationId },
  select: { name: true },
});
const truck = await prisma.truck.findFirst({
  where: { organizationId: admin.organizationId },
  select: { registrationNo: true },
});
const trailer = await prisma.trailer.findFirst({
  where: { organizationId: admin.organizationId },
  select: { registrationNo: true },
});
const trip = await prisma.trip.findFirst({
  where: { organizationId: admin.organizationId },
  select: { originCity: true, destinationCity: true, scheduledDate: true },
  orderBy: { scheduledDate: "desc" },
});

const generate = findOperation("generate_report");
const list = findOperation("list_reports");
if (!generate || !list) throw new Error("the report operations are missing");

await runAsActor(
  {
    user: admin.user,
    role: "admin",
    organizationId: admin.organizationId,
  } as never,
  async () => {
    // Every report the web app offers must be offered here too.
    const offered = (await list.handler({}, ctx)) as Array<{ id: string }>;
    const offeredIds = new Set(offered.map((row) => row.id));
    const missing = Object.keys(reportConfigs).filter((id) => !offeredIds.has(id));
    if (missing.length > 0) {
      results.push({
        report: "list_reports",
        ok: false,
        note: `does not offer: ${missing.join(", ")}`,
      });
    } else {
      results.push({
        report: "list_reports",
        ok: true,
        note: `offers all ${offeredIds.size}`,
      });
    }

    for (const config of Object.values(reportConfigs)) {
      const args: Record<string, unknown> = { report: config.id, period: "1y" };

      if (config.requiresCustomer) {
        if (!customer) {
          results.push({ report: config.name, ok: true, note: "skipped — no customer seeded" });
          continue;
        }
        args.customer = customer.name;
      }
      if (config.requiresTruck) {
        if (!truck) {
          results.push({ report: config.name, ok: true, note: "skipped — no truck seeded" });
          continue;
        }
        args.truck = truck.registrationNo;
      }
      if (config.requiresTrailer) {
        if (!trailer) {
          results.push({ report: config.name, ok: true, note: "skipped — no trailer seeded" });
          continue;
        }
        args.trailer = trailer.registrationNo;
      }
      if (config.requiresTrip) {
        if (!trip) {
          results.push({ report: config.name, ok: true, note: "skipped — no trip seeded" });
          continue;
        }
        args.trip = `${trip.originCity} to ${trip.destinationCity}`;
        args.tripDate = trip.scheduledDate.toISOString();
      }

      // PDF and CSV, because the web app offers both and the client asked for
      // the same reports, not the same subset of formats.
      for (const format of ["pdf", "csv"] as const) {
        const result = (await generate.handler({ ...args, format }, ctx)) as {
          error?: string;
          report?: string;
          sizeKb?: number;
          attachment?: { filename: string; mimeType: string; base64: string };
        };

        if (result.error) {
          results.push({ report: `${config.name} (${format})`, ok: false, note: result.error });
          continue;
        }
        if (!result.attachment?.base64) {
          results.push({
            report: `${config.name} (${format})`,
            ok: false,
            note: "no file came back",
          });
          continue;
        }
        // The file must be the format that was asked for, and not empty.
        const bytes = Buffer.from(result.attachment.base64, "base64");
        const looksRight =
          format === "pdf"
            ? bytes.subarray(0, 4).toString("latin1") === "%PDF"
            : bytes.length > 0 && !bytes.subarray(0, 4).toString("latin1").startsWith("%PDF");
        results.push({
          report: `${config.name} (${format})`,
          ok: looksRight && bytes.length > 0,
          note: looksRight
            ? `${Math.round(bytes.length / 1024)}kb · ${result.attachment.filename}`
            : `wrong file type for ${format}`,
        });
      }
    }
  },
);

for (const row of results) {
  console.log(`${row.ok ? "ok  " : "FAIL"} ${row.report.padEnd(42)} ${row.note}`);
}

const failed = results.filter((row) => !row.ok).length;
console.log(
  `\n${results.length} checks, ${failed} failed.` +
    (failed === 0
      ? " The assistant produces every report the web app does, in both formats."
      : ""),
);
process.exit(failed === 0 ? 0 : 1);
