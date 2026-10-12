import "server-only";

/**
 * A trip's revenue, derived from what was actually invoiced for it.
 *
 * This is the closing edge of the circle the client reported missing: "a
 * payment was not being credited as revenue towards the associated truck, and
 * not appearing under that truck, it was just showing a negative."
 *
 * Every revenue figure in this app comes from `Trip.revenue` and nothing else
 * — `getEarnedRevenue`, the truck cost breakdown, the fleet ranking, the
 * driver snapshots (see `lib/metrics/revenue.ts`). Nothing read invoices. And
 * the revenue field on the trip form is admin-only, so **every trip a
 * supervisor or staff member booked was saved at zero**. The work was then
 * invoiced, the customer paid, fuel and tolls were booked against the truck,
 * and the truck's page showed revenue 0 against real costs: a loss, in red,
 * for a truck that had earned its keep.
 *
 * The fix keeps one definition of revenue rather than adding a second. An
 * invoice raised against a trip writes that trip's revenue, so the existing
 * machinery — which already measures everything from `Trip.revenue` — starts
 * telling the truth without any of it changing.
 *
 * Credit notes are excluded. A credit is money given back, and netting it off
 * the trip's revenue would quietly make the work look smaller than it was;
 * what a credit belongs against is the customer's balance, which
 * `recomputeCustomerBalance` already handles.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

export interface TripRevenueResult {
  /** What the trip's revenue is now. */
  revenue: number;
  /** What it was before, when the two disagreed. */
  previous: number;
  /** How many invoices it was derived from. */
  invoices: number;
  changed: boolean;
}

/**
 * Recompute one trip's revenue from its invoices.
 *
 * Call it inside the same transaction as any write that creates, changes or
 * removes an invoice's trip link or its total — the same invariant
 * `recomputeInvoiceTotals` and `recomputeCustomerBalance` are called under.
 *
 * A trip with no invoices is left exactly as it is. That matters: an admin who
 * typed an agreed price onto a trip that has not been invoiced yet should not
 * have it wiped to zero by a recompute, and a trip whose only invoice was just
 * deleted keeps the last figure rather than losing its history silently.
 */
export async function recomputeTripRevenue(
  tripId: string,
  client: Client = prisma,
): Promise<TripRevenueResult> {
  const trip = await client.trip.findUnique({
    where: { id: tripId },
    select: { revenue: true },
  });
  const previous = trip?.revenue ?? 0;

  const invoiced = await client.invoice.aggregate({
    where: { tripId, isCredit: false },
    _sum: { total: true },
    _count: true,
  });

  if (invoiced._count === 0) {
    return { revenue: previous, previous, invoices: 0, changed: false };
  }

  const revenue = Math.round((invoiced._sum.total ?? 0) * 100) / 100;
  if (revenue === previous) {
    return { revenue, previous, invoices: invoiced._count, changed: false };
  }

  await client.trip.update({ where: { id: tripId }, data: { revenue } });
  return { revenue, previous, invoices: invoiced._count, changed: true };
}

/**
 * The same, for a trip id that may be null or may have just changed.
 *
 * Editing an invoice can move it from one trip to another, which leaves two
 * trips needing a recompute — the one it left and the one it joined. Passing
 * both here is less error-prone than remembering to call it twice.
 */
export async function recomputeTripRevenueFor(
  tripIds: Array<string | null | undefined>,
  client: Client = prisma,
): Promise<void> {
  const unique = [...new Set(tripIds.filter((id): id is string => Boolean(id)))];
  for (const tripId of unique) {
    await recomputeTripRevenue(tripId, client);
  }
}
