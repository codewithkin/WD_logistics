/**
 * Gives every already-invoiced trip the revenue it earned.
 *
 * An invoice raised against a trip now writes that trip's revenue (see
 * `src/lib/metrics/trip-revenue.ts`), but nothing did before — and the revenue
 * field on the trip form is admin-only, so every trip a supervisor or staff
 * member booked was saved at zero. A live system therefore has months of trips
 * that were invoiced, paid for, and still read as a loss on their truck.
 *
 * This walks the invoices already on record and sets each trip's revenue to
 * what was billed for it. Nothing else is touched: no invoice, no payment, no
 * account, no customer balance.
 *
 * Run:
 *   bun prisma/backfill-trip-revenue.ts            # dry run, prints the plan
 *   bun prisma/backfill-trip-revenue.ts --apply    # writes it
 *
 * Idempotent: a trip whose revenue already matches its invoices is left alone,
 * so running it twice changes nothing the second time.
 *
 * ## What it deliberately does not do
 *
 * - **Credit notes are excluded.** A credit is money handed back; netting it
 *   off would make the work look smaller than it was. That belongs on the
 *   customer's balance, which is derived separately.
 * - **Trips with no invoices are skipped**, not zeroed. An admin's agreed
 *   price on a trip that has not been billed yet is real information.
 * - **A figure that disagrees is reported before it is overwritten.** Where an
 *   admin typed a price and the invoices say something else, the invoices win
 *   — they are what the customer was actually asked to pay — but the old
 *   figure is printed for every row so a surprise can be caught in the dry run
 *   rather than after the fact.
 */

import { prisma } from "../src/lib/prisma";

const APPLY = process.argv.includes("--apply");

interface Change {
  tripId: string;
  route: string;
  date: Date;
  truck: string;
  previous: number;
  invoiced: number;
  invoiceCount: number;
}

const money = (amount: number) =>
  `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

async function main() {
  const organizations = await prisma.organization.findMany({
    select: { id: true, name: true },
  });

  let totalChanges = 0;
  let totalRaised = 0;

  for (const organization of organizations) {
    // Every trip that has at least one non-credit invoice.
    const trips = await prisma.trip.findMany({
      where: {
        organizationId: organization.id,
        invoices: { some: { isCredit: false } },
      },
      select: {
        id: true,
        revenue: true,
        originCity: true,
        destinationCity: true,
        scheduledDate: true,
        truck: { select: { registrationNo: true } },
        invoices: {
          where: { isCredit: false },
          select: { total: true, invoiceNumber: true },
        },
      },
      orderBy: { scheduledDate: "asc" },
    });

    const changes: Change[] = [];

    for (const trip of trips) {
      const invoiced =
        Math.round(trip.invoices.reduce((sum, invoice) => sum + invoice.total, 0) * 100) / 100;
      if (invoiced === trip.revenue) continue;

      changes.push({
        tripId: trip.id,
        route: `${trip.originCity} → ${trip.destinationCity}`,
        date: trip.scheduledDate,
        truck: trip.truck?.registrationNo ?? "—",
        previous: trip.revenue,
        invoiced,
        invoiceCount: trip.invoices.length,
      });
    }

    if (changes.length === 0) {
      console.log(`\n${organization.name}: every invoiced trip already carries its revenue.`);
      continue;
    }

    console.log(`\n${organization.name}: ${changes.length} trip(s) to update`);
    console.log(
      `${"date".padEnd(12)}${"truck".padEnd(12)}${"route".padEnd(30)}${"was".padStart(12)}${"becomes".padStart(14)}`,
    );

    for (const change of changes) {
      const date = change.date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
      });
      // A trip that already had a figure is the one worth looking at twice.
      const flag = change.previous > 0 ? "  ← had a figure" : "";
      console.log(
        `${date.padEnd(12)}${change.truck.padEnd(12)}${change.route.slice(0, 29).padEnd(30)}` +
          `${money(change.previous).padStart(12)}${money(change.invoiced).padStart(14)}${flag}`,
      );
    }

    const raised = changes.reduce((sum, c) => sum + (c.invoiced - c.previous), 0);
    const overwritten = changes.filter((c) => c.previous > 0);
    console.log(
      `  total revenue recognised: ${money(raised)}` +
        (overwritten.length
          ? `, of which ${overwritten.length} trip(s) had a figure already — check those rows`
          : ""),
    );

    if (APPLY) {
      for (const change of changes) {
        await prisma.trip.update({
          where: { id: change.tripId },
          data: { revenue: change.invoiced },
        });
      }
      console.log(`  ✅ applied to ${changes.length} trip(s)`);
    }

    totalChanges += changes.length;
    totalRaised += raised;
  }

  console.log(
    `\n${totalChanges} trip(s), ${money(totalRaised)} of revenue ${APPLY ? "recognised" : "to recognise"}.`,
  );
  if (!APPLY && totalChanges > 0) {
    console.log("Dry run — nothing was written. Re-run with --apply once the rows above look right.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("❌ backfill-trip-revenue failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
