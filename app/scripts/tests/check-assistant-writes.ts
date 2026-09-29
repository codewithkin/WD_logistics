/**
 * Exercises the assistant's write operations against the real database.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-assistant-writes.ts
 *
 * The access audit proves each operation is offered at the right level and
 * carries no money it should not. It does not prove the operation *works* —
 * a handler that resolves the wrong field, or passes a date where the action
 * wants a Date, fails only when somebody tries it from a phone.
 *
 * So this calls them: as an admin, in sequence, against seeded records, and
 * then removes everything it created. Each step asserts what came back.
 *
 * No model is involved — the handlers are invoked directly, so running this
 * costs nothing. It does write to the database it is pointed at, so point it
 * at a development one.
 */

import { z } from "zod";
import { findOperation } from "../../src/lib/assistant/operations";
import { prisma } from "../../src/lib/prisma";
import { runAsActor } from "../../src/lib/acting-session";
import { beginReplay, endReplay } from "../../src/lib/edit-requests/gate";

interface Check {
  step: string;
  ok: boolean;
  note: string;
}

const results: Check[] = [];

function record(step: string, ok: boolean, note: string) {
  results.push({ step, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${step.padEnd(34)} ${note}`);
}

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

/**
 * Calls an operation exactly as the route does — including `.strict()`.
 *
 * That matters: Zod strips unknown keys by default, so without it a test can
 * pass an argument the operation does not have, watch it be discarded, and
 * report a pass on behaviour the real endpoint would have refused. The route
 * rejects unknown keys for this reason, and so does this.
 */
async function call(name: string, args: Record<string, unknown>) {
  const operation = findOperation(name);
  if (!operation) throw new Error(`no operation called ${name}`);
  const schema =
    operation.schema instanceof z.ZodObject ? operation.schema.strict() : operation.schema;
  const parsed = schema.safeParse(args);
  if (!parsed.success) {
    return { error: `arguments rejected: ${parsed.error.issues.map((i) => i.message).join(", ")}` };
  }
  return (await operation.handler(
    parsed.data as Record<string, unknown>,
    ctx,
  )) as Record<string, unknown>;
}

const customer = await prisma.customer.findFirst({
  where: { organizationId: admin.organizationId },
  select: { id: true, name: true },
});
const supplier = await prisma.supplier.findFirst({
  where: { organizationId: admin.organizationId },
  select: { id: true, name: true },
});
if (!customer || !supplier) throw new Error("seed a customer and a supplier first");

// Anything this run creates, so it can be taken out again even if a step
// throws. Ids are collected as they are made.
const created: { invoiceIds: string[]; paymentIds: string[]; supplierPaymentIds: string[] } = {
  invoiceIds: [],
  paymentIds: [],
  supplierPaymentIds: [],
};

try {
  await runAsActor(
    {
      user: admin.user,
      role: "admin",
      organizationId: admin.organizationId,
    } as never,
    async () => {
      // ------------------------------------------------------------ invoices
      const due = new Date();
      due.setDate(due.getDate() + 30);

      const raised = await call("create_invoice", {
        customer: customer.name,
        amount: 1234.56,
        dueDate: due.toISOString(),
        onCredit: true,
        notes: "Assistant write check",
      });
      record(
        "create_invoice",
        raised.raised === true,
        (raised.error as string) ?? `${raised.amount} for ${raised.customer}`,
      );

      const invoice = await prisma.invoice.findFirst({
        where: { organizationId: admin.organizationId, notes: "Assistant write check" },
        orderBy: { createdAt: "desc" },
        select: { id: true, invoiceNumber: true, total: true, balance: true },
      });
      if (!invoice) {
        record("invoice reached the database", false, "not found");
        return;
      }
      created.invoiceIds.push(invoice.id);
      record(
        "invoice reached the database",
        invoice.total === 1234.56 && invoice.balance === 1234.56,
        `${invoice.invoiceNumber}: total ${invoice.total}, outstanding ${invoice.balance}`,
      );

      const changed = await call("update_invoice", {
        invoice: invoice.invoiceNumber,
        reason: "Rate corrected after re-weighing the load",
        amount: 1500,
      });
      const afterChange = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        select: { total: true, balance: true },
      });
      record(
        "update_invoice",
        !changed.error && afterChange?.total === 1500 && afterChange?.balance === 1500,
        (changed.error as string) ??
          `total ${afterChange?.total}, outstanding recomputed to ${afterChange?.balance}`,
      );

      const document = await call("send_invoice_document", { invoice: invoice.invoiceNumber });
      const attachment = document.attachment as { base64?: string; filename?: string } | undefined;
      const isPdf =
        attachment?.base64 !== undefined &&
        Buffer.from(attachment.base64, "base64").subarray(0, 4).toString("latin1") === "%PDF";
      record(
        "send_invoice_document",
        isPdf,
        (document.error as string) ?? `${attachment?.filename}`,
      );

      // ------------------------------------------------------------ payments
      const paid = await call("record_payment", {
        customer: customer.name,
        amount: 500,
        invoiceNumber: invoice.invoiceNumber,
        method: "bank_transfer",
      });
      record("record_payment", !paid.error, (paid.error as string) ?? "500 recorded");

      const payment = await prisma.payment.findFirst({
        where: { invoiceId: invoice.id },
        orderBy: { createdAt: "desc" },
        select: { id: true, amount: true },
      });
      if (payment) created.paymentIds.push(payment.id);

      const afterPayment = await prisma.invoice.findUnique({
        where: { id: invoice.id },
        select: { amountPaid: true, balance: true, status: true },
      });
      record(
        "invoice follows its payment",
        afterPayment?.amountPaid === 500 && afterPayment?.balance === 1000,
        `paid ${afterPayment?.amountPaid}, outstanding ${afterPayment?.balance}, ${afterPayment?.status}`,
      );

      // An edit past the invoice total must be refused — the web form's own
      // guard, which update_payment inherits by calling the same action.
      const overpay = await call("update_payment", {
        payment: invoice.invoiceNumber,
        reason: "Testing the overpayment guard",
        amount: 99999,
      });
      record(
        "overpayment refused",
        Boolean(overpay.error),
        (overpay.error as string) ?? "it was allowed, which is wrong",
      );

      const receipt = await call("send_payment_receipt", { payment: invoice.invoiceNumber });
      const receiptFile = receipt.attachment as { base64?: string } | undefined;
      record(
        "send_payment_receipt",
        receiptFile?.base64 !== undefined &&
          Buffer.from(receiptFile.base64, "base64").subarray(0, 4).toString("latin1") === "%PDF",
        (receipt.error as string) ?? `${receipt.amount} receipted`,
      );

      // --------------------------------------------------- supplier payments
      const before = await prisma.supplier.findUnique({
        where: { id: supplier.id },
        select: { balance: true },
      });
      const supplierPaid = await call("pay_supplier", {
        supplier: supplier.name,
        amount: 250,
        method: "cash",
        description: "Assistant write check",
      });
      const after = await prisma.supplier.findUnique({
        where: { id: supplier.id },
        select: { balance: true },
      });
      record(
        "pay_supplier",
        !supplierPaid.error &&
          Math.round(((before?.balance ?? 0) - (after?.balance ?? 0)) * 100) === 25000,
        (supplierPaid.error as string) ??
          `owed ${before?.balance} then ${after?.balance}`,
      );

      const supplierPayment = await prisma.supplierPayment.findFirst({
        where: { supplierId: supplier.id, description: "Assistant write check" },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });
      if (supplierPayment) created.supplierPaymentIds.push(supplierPayment.id);

      // ------------------------------------------------------- ambiguity and
      // refusals, which matter as much as the happy path
      const noSuch = await call("create_invoice", {
        customer: "Definitely Not A Customer Ltd",
        amount: 10,
      });
      record(
        "unknown customer refused",
        typeof noSuch.error === "string" && noSuch.error.includes("No customer"),
        (noSuch.error as string) ?? "it was accepted, which is wrong",
      );

      const noDueDate = await call("create_invoice", {
        customer: customer.name,
        amount: 10,
        onCredit: true,
      });
      record(
        "credit terms need a due date",
        typeof noDueDate.error === "string" && noDueDate.error.includes("due date"),
        (noDueDate.error as string) ?? "it was accepted without one",
      );
    },
  );
} finally {
  // Take out everything this run made, whatever happened above. Replay mode
  // is on so the delete actions write directly instead of filing edit
  // requests for an admin who did not ask for any.
  beginReplay();
  try {
    for (const id of created.paymentIds) {
      await prisma.payment.deleteMany({ where: { id } });
    }
    for (const id of created.supplierPaymentIds) {
      const row = await prisma.supplierPayment.findUnique({
        where: { id },
        select: { supplierId: true, amount: true },
      });
      if (row) {
        await prisma.supplier.update({
          where: { id: row.supplierId },
          data: { balance: { increment: row.amount } },
        });
      }
      await prisma.supplierPayment.deleteMany({ where: { id } });
    }
    for (const id of created.invoiceIds) {
      await prisma.invoiceLineItem.deleteMany({ where: { invoiceId: id } });
      await prisma.invoice.deleteMany({ where: { id } });
    }
    await prisma.editRequest.deleteMany({
      where: { reason: { contains: "over WhatsApp" }, entityType: "invoice" },
    });
    console.log(
      `\ncleaned up: ${created.invoiceIds.length} invoice(s), ${created.paymentIds.length} payment(s), ${created.supplierPaymentIds.length} supplier payment(s)`,
    );
  } finally {
    endReplay();
  }
}

const failed = results.filter((row) => !row.ok).length;
console.log(
  `\n${results.length} checks, ${failed} failed.` +
    (failed === 0 ? " Every billing operation works from the assistant." : ""),
);
process.exit(failed === 0 ? 0 : 1);
