import "server-only";

/**
 * An invoice's paid and outstanding figures — derived, never nudged.
 *
 * `Invoice.amountPaid` and `Invoice.balance` are denormalised, and three
 * separate places used to move them by a delta: creating a payment added the
 * amount, editing it applied the difference, deleting it subtracted. Three
 * chances to be wrong, and each one permanent, because nothing ever went back
 * and checked the figure against the payments themselves.
 *
 * Worse, the invoice form computed the balance in the browser from the
 * `amountPaid` it happened to load with and posted it, so a payment recorded
 * between opening the form and saving it silently overwrote the true figure —
 * and on the edit-request path the balance was not a tracked field at all, so
 * approving a change to an invoice's total moved the total and left the
 * balance behind.
 *
 * This recomputes both from the invoice's own payments. Call it inside the
 * same transaction as any write that touches an invoice's total or its
 * payments, which is the invariant CLAUDE.md states for this pair.
 */

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@/generated/prisma/client";

type Client = Prisma.TransactionClient | typeof prisma;

export interface InvoiceTotals {
  amountPaid: number;
  balance: number;
  status: string;
  /** True when this call is what settled it, so a caller can notify once. */
  becamePaid: boolean;
}

/**
 * What the status should be, given what has been paid.
 *
 * Deliberately conservative about the statuses that are not about money:
 * "cancelled" is never overwritten, and a draft stays a draft until somebody
 * pays against it. The old code set "sent" whenever the paid amount reached
 * zero, so deleting the only payment on a draft invoice quietly issued it, and
 * doing the same on an overdue one quietly cleared the overdue flag.
 */
function statusFor(
  current: string,
  total: number,
  amountPaid: number,
  balance: number,
  dueDate: Date | null,
): string {
  if (current === "cancelled") return current;
  if (amountPaid === 0 && current === "draft") return current;

  if (total > 0 && balance <= 0) return "paid";
  if (amountPaid > 0) return "partial";

  // Nothing is paid any more. Only correct a status that claimed otherwise.
  if (current === "paid" || current === "partial") {
    return dueDate && dueDate.getTime() < Date.now() ? "overdue" : "sent";
  }
  return current;
}

export async function recomputeInvoiceTotals(
  invoiceId: string,
  client: Client = prisma,
): Promise<InvoiceTotals | null> {
  const invoice = await client.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, total: true, status: true, dueDate: true },
  });
  if (!invoice) return null;

  const paid = await client.payment.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });

  const amountPaid = round(paid._sum.amount ?? 0);
  const balance = round(invoice.total - amountPaid);
  const status = statusFor(
    invoice.status,
    invoice.total,
    amountPaid,
    balance,
    invoice.dueDate,
  );

  await client.invoice.update({
    where: { id: invoiceId },
    data: { amountPaid, balance, status },
  });

  return {
    amountPaid,
    balance,
    status,
    becamePaid: status === "paid" && invoice.status !== "paid",
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
