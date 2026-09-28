import "server-only";

/**
 * What a customer owes — one definition, derived from their invoices.
 *
 * There were four before this, and they disagreed:
 *
 *   1. the customer report summed `invoice.balance` for invoices *raised in
 *      the period*, so an unpaid invoice from two months ago vanished;
 *   2. the customer detail page did the same but counted cancelled invoices;
 *   3. the customers list and the single-customer report read the stored
 *      `Customer.balance` column, a lifetime figure shown beside
 *      period-filtered columns, with the opposite sign convention;
 *   4. the statement recomputed it again as invoices minus payments.
 *
 * Worse, the stored column drifts and cannot be trusted: it is adjusted when
 * an invoice or a payment is *created* and never when either is edited or
 * deleted, so every correction leaves it permanently wrong.
 *
 * **Outstanding is every unpaid cent on non-cancelled invoices, as of now.**
 * It deliberately ignores the report period: a debt does not stop existing
 * because the invoice that created it was raised before the period started.
 * The client confirmed this reading on 28 Sep 2026.
 *
 * `Invoice.balance` is safe to sum here, unlike `Customer.balance`: all three
 * payment paths recompute it as `total - amountPaid` rather than nudging it
 * by a delta, so it cannot drift.
 */

import { prisma } from "@/lib/prisma";

/** Invoices that represent a real debt. Cancelled ones do not. */
const COUNTS_AS_DEBT = { status: { notIn: ["cancelled"] } };

/** What one customer still owes, across all time. */
export async function outstandingForCustomer(customerId: string): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: { customerId, ...COUNTS_AS_DEBT },
    _sum: { balance: true },
  });
  return round(result._sum?.balance ?? 0);
}

/**
 * What each of several customers owes, keyed by customer id.
 *
 * One query for a whole list page — the alternative was a per-row await, and
 * the customers list renders every customer.
 */
export async function outstandingByCustomer(
  customerIds: string[],
): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();

  const rows = await prisma.invoice.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customerIds }, ...COUNTS_AS_DEBT },
    _sum: { balance: true },
  });

  const owed = new Map<string, number>();
  for (const id of customerIds) owed.set(id, 0);
  for (const row of rows) owed.set(row.customerId, round(row._sum?.balance ?? 0));
  return owed;
}

/** What every customer in the organisation owes, added up. */
export async function outstandingForOrganization(organizationId: string): Promise<number> {
  const result = await prisma.invoice.aggregate({
    where: { organizationId, ...COUNTS_AS_DEBT },
    _sum: { balance: true },
  });
  return round(result._sum?.balance ?? 0);
}

/**
 * Recomputes the stored `Customer.balance` from the invoices.
 *
 * The column is kept because other code and the client's own reports still
 * read it, but it is now *derived* rather than nudged: every write path calls
 * this after changing an invoice or a payment, so an edit or a deletion
 * corrects it instead of leaving it permanently out by the amount involved.
 *
 * Sign convention is preserved — the column is negative when the customer
 * owes money, positive when they are in credit — because the customers table
 * renders "(Owed)" and "(Credit)" from the sign.
 *
 * Pass the transaction client when inside one, so the recompute sees the
 * write that prompted it.
 */
export async function recomputeCustomerBalance(
  customerId: string,
  client: { invoice: { aggregate: typeof prisma.invoice.aggregate }; customer: { update: typeof prisma.customer.update } } = prisma,
): Promise<number> {
  const result = await client.invoice.aggregate({
    where: { customerId, ...COUNTS_AS_DEBT },
    _sum: { balance: true },
  });

  const owed = round(result._sum?.balance ?? 0);
  await client.customer.update({
    where: { id: customerId },
    data: { balance: -owed },
  });

  return owed;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
