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
const created = {
  invoiceIds: [] as string[],
  paymentIds: [] as string[],
  supplierPaymentIds: [] as string[],
  categoryIds: [] as string[],
  employeeIds: [] as string[],
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

      // ------------------------------------------------------------ accounts
      const cashBefore = await prisma.financialAccount.findFirst({
        where: { organizationId: admin.organizationId, type: "cash" },
        select: { balance: true },
      });
      const moneyIn = await call("record_money_in", {
        account: "cash",
        amount: 400,
        description: "Assistant write check float",
      });
      const cashAfter = await prisma.financialAccount.findFirst({
        where: { organizationId: admin.organizationId, type: "cash" },
        select: { balance: true },
      });
      record(
        "record_money_in",
        !moneyIn.error &&
          Math.round(((cashAfter?.balance ?? 0) - (cashBefore?.balance ?? 0)) * 100) === 40000,
        (moneyIn.error as string) ?? `cash ${cashBefore?.balance} then ${cashAfter?.balance}`,
      );

      const moneyOut = await call("record_money_out", {
        account: "cash",
        amount: 400,
        description: "Assistant write check, returning the float",
      });
      const cashBack = await prisma.financialAccount.findFirst({
        where: { organizationId: admin.organizationId, type: "cash" },
        select: { balance: true },
      });
      record(
        "record_money_out",
        !moneyOut.error &&
          Math.round(((cashBack?.balance ?? 0) - (cashBefore?.balance ?? 0)) * 100) === 0,
        (moneyOut.error as string) ?? `back to ${cashBack?.balance}`,
      );

      const overdraw = await call("record_money_out", {
        account: "petty_cash",
        amount: 9_999_999,
        description: "Testing the overdraw guard",
      });
      record(
        "overdrawing refused",
        Boolean(overdraw.error),
        (overdraw.error as string) ?? "it was allowed, which is wrong",
      );

      // -------------------------------------------------- expense categories
      const madeCategory = await call("create_expense_category", {
        name: "Assistant check category",
        kind: "other",
        againstTrucks: true,
      });
      record(
        "create_expense_category",
        madeCategory.created === true,
        (madeCategory.error as string) ?? "created",
      );

      const categoryRow = await prisma.expenseCategory.findFirst({
        where: { organizationId: admin.organizationId, name: "Assistant check category" },
        select: { id: true },
      });
      if (categoryRow) created.categoryIds.push(categoryRow.id);

      const renamed = await call("update_expense_category", {
        category: "Assistant check category",
        kind: "tyres",
      });
      const afterRename = categoryRow
        ? await prisma.expenseCategory.findUnique({
            where: { id: categoryRow.id },
            select: { kind: true, name: true },
          })
        : null;
      record(
        "update_expense_category",
        !renamed.error && afterRename?.kind === "tyres" && afterRename?.name === "Assistant check category",
        (renamed.error as string) ?? `kind now ${afterRename?.kind}, name kept`,
      );

      const removedCategory = await call("delete_expense_category", {
        category: "Assistant check category",
      });
      record(
        "delete_expense_category",
        removedCategory.deleted === true,
        (removedCategory.error as string) ?? "removed",
      );
      if (removedCategory.deleted === true) created.categoryIds.length = 0;

      // --------------------------------------------------------- an employee
      const madeEmployee = await call("create_employee", {
        firstName: "Assistant",
        lastName: "Checkperson",
        phone: "+263770000001",
        position: "Yard hand",
      });
      record(
        "create_employee",
        madeEmployee.created === true,
        (madeEmployee.error as string) ?? "created",
      );

      const employeeRow = await prisma.employee.findFirst({
        where: { organizationId: admin.organizationId, lastName: "Checkperson" },
        select: { id: true },
      });
      if (employeeRow) created.employeeIds.push(employeeRow.id);

      const movedEmployee = await call("update_employee", {
        employee: "Checkperson",
        reason: "Moved to the workshop",
        position: "Workshop assistant",
      });
      const afterMove = employeeRow
        ? await prisma.employee.findUnique({
            where: { id: employeeRow.id },
            select: { position: true },
          })
        : null;
      record(
        "update_employee",
        !movedEmployee.error && afterMove?.position === "Workshop assistant",
        (movedEmployee.error as string) ?? `position now ${afterMove?.position}`,
      );

      const goneEmployee = await call("delete_employee", { employee: "Checkperson" });
      record(
        "delete_employee",
        goneEmployee.deleted === true,
        (goneEmployee.error as string) ?? "removed",
      );
      if (goneEmployee.deleted === true) created.employeeIds.length = 0;

      // ------------------------------------------------------------- a trip
      const someTrip = await prisma.trip.findFirst({
        where: { organizationId: admin.organizationId },
        select: { id: true, originCity: true, destinationCity: true, scheduledDate: true, notes: true },
        orderBy: { scheduledDate: "desc" },
      });
      if (someTrip) {
        const noted = await call("update_trip", {
          trip: `${someTrip.originCity} to ${someTrip.destinationCity}`,
          tripDate: someTrip.scheduledDate.toISOString(),
          reason: "Note added during the assistant write check",
          notes: "ASSISTANT-CHECK-NOTE",
        });
        const afterNote = await prisma.trip.findUnique({
          where: { id: someTrip.id },
          select: { notes: true },
        });
        record(
          "update_trip",
          !noted.error && afterNote?.notes === "ASSISTANT-CHECK-NOTE",
          (noted.error as string) ?? "note written",
        );
        // Put the trip back the way it was.
        await prisma.trip.update({
          where: { id: someTrip.id },
          data: { notes: someTrip.notes },
        });
      }

      // ------------------------------------------------- a supplier balance
      const owedBefore = await prisma.supplier.findUnique({
        where: { id: supplier.id },
        select: { balance: true },
      });
      const adjusted = await call("adjust_supplier_balance", {
        supplier: supplier.name,
        amount: 75,
      });
      const owedAfter = await prisma.supplier.findUnique({
        where: { id: supplier.id },
        select: { balance: true },
      });
      record(
        "adjust_supplier_balance",
        !adjusted.error &&
          Math.round(((owedAfter?.balance ?? 0) - (owedBefore?.balance ?? 0)) * 100) === 7500,
        (adjusted.error as string) ?? `owed ${owedBefore?.balance} then ${owedAfter?.balance}`,
      );
      await prisma.supplier.update({
        where: { id: supplier.id },
        data: { balance: owedBefore?.balance ?? 0 },
      });

      // ------------------------------------------------------ ambiguity and
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
    for (const id of created.categoryIds) {
      await prisma.expenseCategory.deleteMany({ where: { id } });
    }
    for (const id of created.employeeIds) {
      await prisma.employee.deleteMany({ where: { id } });
    }
    // The float in and back out again leaves two ledger rows; they are the
    // record of a real movement, so they stay, but the note says why.
    await prisma.accountTransaction.deleteMany({
      where: { description: { contains: "Assistant write check" } },
    });
    await prisma.editRequest.deleteMany({
      where: { reason: { contains: "over WhatsApp" }, entityType: "invoice" },
    });
    console.log(
      `\ncleaned up: ${created.invoiceIds.length} invoice(s), ${created.paymentIds.length} payment(s), ` +
        `${created.supplierPaymentIds.length} supplier payment(s), ${created.categoryIds.length} category(ies), ` +
        `${created.employeeIds.length} employee(s)`,
    );
  } finally {
    endReplay();
  }
}

const failed = results.filter((row) => !row.ok).length;
console.log(
  `\n${results.length} checks, ${failed} failed.` +
    (failed === 0 ? " Every write the assistant offers works." : ""),
);
process.exit(failed === 0 ? 0 : 1);
