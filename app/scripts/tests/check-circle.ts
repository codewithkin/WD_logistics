/**
 * The circle: does money that goes in one side come out the other?
 *
 * Every assertion here is a bug the client reported in their live system,
 * written down so it cannot come back:
 *
 *  - "when a payment is made, it was not being credited as revenue towards the
 *    associated truck… it was just showing a negative" — an invoice raised
 *    against a trip has to reach that trip, and through it the truck.
 *  - "changes to the cash account (e.g. money in) was not affecting the balance
 *    of that account" — a payment has to move the account it was received into.
 *  - "then expenses paid for that particular category were not affecting the
 *    balance again" — an expense whose category names an account has to move
 *    it, and one whose category names none has to leave it alone rather than
 *    half-move it.
 *  - "when a brake pad is taken out of inventory and it's worth $20, going
 *    towards truck X, make truck X's expenses go up by the value of those brake
 *    pads and have it recorded as an expense as well" — and, the client's own
 *    decision on 12 Oct, *without* taking the money out of an account a second
 *    time, because it left when the parts were bought.
 *
 * Runs against the real dev database as a real admin, through the real server
 * actions — a reimplementation against Prisma would prove nothing, since every
 * one of these defects was an action that wrote a row and moved no figure.
 * Everything it creates is deleted in `finally`, and the account balances it
 * touches are put back, because `balance` is denormalised and deleting the
 * ledger rows does not undo their effect.
 *
 * Usage: bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-circle.ts
 */

import "dotenv/config";
import { prisma } from "../../src/lib/prisma";
import { runAsActor } from "../../src/lib/acting-session";
import { ensureAccountsExist } from "../../src/lib/accounts-server";
import { getTruckCostBreakdown } from "../../src/lib/metrics/truck-costs";

const results: Array<{ step: string; ok: boolean; note: string }> = [];

function record(step: string, ok: boolean, note: string) {
  results.push({ step, ok, note });
  console.log(`${ok ? "  ok  " : " FAIL "} ${step} — ${note}`);
}

/** The reason an action refused, whichever shape of result it returned. */
const why = (result: unknown) =>
  result && typeof result === "object" && "error" in result
    ? String((result as { error: unknown }).error)
    : "refused";

/** Rounded the way money is compared, so 39.999999 is 40. */
const money = (value: number) => Math.round(value * 100) / 100;
const near = (a: number, b: number) => Math.abs(money(a) - money(b)) < 0.005;

const RUN = Date.now().toString(36);

async function main() {
  const admin = await prisma.member.findFirst({
    where: { role: "admin" },
    include: { user: { select: { id: true, name: true, email: true, image: true } } },
  });
  if (!admin) throw new Error("no admin member — run db:seed or prisma/ensure-admin.mjs first");

  const organizationId = admin.organizationId;
  const session = { user: admin.user, role: "admin", organizationId } as never;

  // Balances as they stand, to restore at the end.
  await ensureAccountsExist(organizationId);
  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId },
    select: { id: true, type: true, balance: true },
  });
  const bank = accounts.find((a) => a.type === "bank")!;
  const cash = accounts.find((a) => a.type === "cash")!;
  const petty = accounts.find((a) => a.type === "petty_cash")!;
  const balancesBefore = new Map(accounts.map((a) => [a.id, a.balance]));

  const created = {
    invoiceIds: [] as string[],
    paymentIds: [] as string[],
    expenseIds: [] as string[],
    tripIds: [] as string[],
    truckIds: [] as string[],
    driverIds: [] as string[],
    customerIds: [] as string[],
    categoryIds: [] as string[],
    itemIds: [] as string[],
    movementIds: [] as string[],
  };

  try {
    // ---------------------------------------------------------- fixtures
    const truck = await prisma.truck.create({
      data: {
        organizationId,
        registrationNo: `CIRCLE-${RUN}`,
        make: "Circle",
        model: "Check",
        year: 2024,
        status: "active",
      },
    });
    created.truckIds.push(truck.id);

    const customer = await prisma.customer.create({
      data: { organizationId, name: `Circle Customer ${RUN}`, phone: "+263770000111" },
    });
    created.customerIds.push(customer.id);

    // A trip the invoice will be raised against, created with revenue 0 —
    // which is exactly how a supervisor's trip is created, the revenue field
    // on the form being admin-only.
    const driver = await prisma.driver.create({
      data: {
        organizationId,
        firstName: "Circle",
        lastName: `Driver ${RUN}`,
        phone: "+263770000112",
        licenseNumber: `CIRCLE-${RUN}`,
      },
    });
    created.driverIds.push(driver.id);

    const trip = await prisma.trip.create({
      data: {
        organizationId,
        truckId: truck.id,
        driverId: driver.id,
        customerId: customer.id,
        originCity: "Harare",
        destinationCity: "Beitbridge",
        scheduledDate: new Date(),
        startDate: new Date(),
        endDate: new Date(),
        estimatedMileage: 580,
        actualMileage: 580,
        status: "completed",
        revenue: 0,
      },
    });
    created.tripIds.push(trip.id);

    const trip2 = await prisma.trip.create({
      data: {
        organizationId,
        truckId: truck.id,
        driverId: driver.id,
        customerId: customer.id,
        originCity: "Harare",
        destinationCity: "Mutare",
        scheduledDate: new Date(),
        startDate: new Date(),
        endDate: new Date(),
        estimatedMileage: 263,
        actualMileage: 263,
        status: "completed",
        revenue: 0,
      },
    });
    created.tripIds.push(trip2.id);

    // Two categories: one that names an account, one that names none. Both
    // halves of the client's "expenses were not affecting the balance".
    const wired = await prisma.expenseCategory.create({
      data: {
        organizationId,
        name: `Circle Fuel ${RUN}`,
        kind: "fuel",
        isTruck: true,
        isTrip: true,
        defaultAccountId: cash.id,
      },
    });
    const unwired = await prisma.expenseCategory.create({
      data: {
        organizationId,
        name: `Circle Parts ${RUN}`,
        kind: "maintenance",
        isTruck: true,
        defaultAccountId: null,
      },
    });
    created.categoryIds.push(wired.id, unwired.id);

    const item = await prisma.inventoryItem.create({
      data: {
        organizationId,
        name: `Circle Brake Pad ${RUN}`,
        unit: "units",
        quantity: 10,
        minQuantity: 1,
        unitCost: 20,
        defaultExpenseCategoryId: unwired.id,
      },
    });
    created.itemIds.push(item.id);

    const uncosted = await prisma.inventoryItem.create({
      data: {
        organizationId,
        name: `Circle Unpriced Part ${RUN}`,
        unit: "units",
        quantity: 5,
        minQuantity: 1,
        unitCost: 15,
        defaultExpenseCategoryId: null,
      },
    });
    created.itemIds.push(uncosted.id);

    const range = { from: new Date(Date.now() - 86_400_000), to: new Date(Date.now() + 86_400_000) };

    await runAsActor(session, async () => {
      const { createInvoice } = await import("../../src/app/(dashboard)/finance/invoices/actions");
      const { createPayment } = await import("../../src/app/(dashboard)/finance/payments/actions");
      const { createExpense } = await import("../../src/app/(dashboard)/finance/expenses/actions");
      const { takeOutStock } = await import("../../src/app/(dashboard)/inventory/actions");

      // ------------------------------------------- 1. invoice → trip → truck
      const invoiced = await createInvoice({
        customerId: customer.id,
        tripId: trip.id,
        amount: 4000,
        status: "sent",
        dueDate: new Date(Date.now() + 30 * 86_400_000),
      });
      if (!invoiced.success || !invoiced.invoice) {
        record("invoice raised against a trip", false, why(invoiced));
        return;
      }
      created.invoiceIds.push(invoiced.invoice.id);

      const afterInvoice = await prisma.trip.findUnique({
        where: { id: trip.id },
        select: { revenue: true },
      });
      record(
        "an invoice raised against a trip becomes that trip's revenue",
        near(afterInvoice?.revenue ?? 0, 4000),
        `trip revenue ${afterInvoice?.revenue} (was 0, invoice 4000)`,
      );

      const truckAfterInvoice = await getTruckCostBreakdown(organizationId, truck.id, range);
      record(
        "and reaches the truck that ran the trip",
        near(truckAfterInvoice.revenue, 4000),
        `truck revenue ${truckAfterInvoice.revenue}`,
      );

      // --------------------------------------------- 2. payment → account
      const bankBefore =
        (await prisma.financialAccount.findUnique({ where: { id: bank.id } }))?.balance ?? 0;

      const paid = await createPayment({
        invoiceId: invoiced.invoice.id,
        customerId: customer.id,
        amount: 1500,
        paymentDate: new Date(),
        method: "bank_transfer",
        accountId: bank.id,
        notes: `circle check ${RUN}`,
      });
      if (!paid.success || !paid.payment) {
        record("payment recorded", false, why(paid));
        return;
      }
      created.paymentIds.push(paid.payment.id);

      const bankAfter =
        (await prisma.financialAccount.findUnique({ where: { id: bank.id } }))?.balance ?? 0;
      record(
        "a payment credits the account it was received into",
        near(bankAfter - bankBefore, 1500),
        `bank ${bankBefore} → ${bankAfter}`,
      );

      const ledgerRow = await prisma.accountTransaction.findFirst({
        where: { accountId: bank.id, amount: 1500, type: "deposit" },
        orderBy: { createdAt: "desc" },
        select: { id: true, description: true },
      });
      record(
        "and appears in that account's ledger",
        Boolean(ledgerRow),
        ledgerRow ? `"${ledgerRow.description}"` : "no deposit row written",
      );

      const invoiceAfterPayment = await prisma.invoice.findUnique({
        where: { id: invoiced.invoice.id },
        select: { amountPaid: true, balance: true, status: true },
      });
      record(
        "and comes off the invoice balance",
        near(invoiceAfterPayment?.amountPaid ?? 0, 1500) &&
          near(invoiceAfterPayment?.balance ?? 0, 2500),
        `paid ${invoiceAfterPayment?.amountPaid}, balance ${invoiceAfterPayment?.balance}, ${invoiceAfterPayment?.status}`,
      );

      // ------------------------------------------- 3. expense → account
      const cashBefore =
        (await prisma.financialAccount.findUnique({ where: { id: cash.id } }))?.balance ?? 0;

      const fuel = await createExpense({
        categoryId: wired.id,
        amount: 300,
        quantity: 200,
        unit: "litres",
        date: new Date(),
        truckIds: [truck.id],
      });
      if (!fuel.success) {
        record("expense recorded", false, why(fuel));
        return;
      }

      const cashAfterFuel =
        (await prisma.financialAccount.findUnique({ where: { id: cash.id } }))?.balance ?? 0;
      record(
        "an expense in a category with an account takes the money out of it",
        near(cashBefore - cashAfterFuel, 300),
        `cash ${cashBefore} → ${cashAfterFuel}`,
      );

      const balancesBeforeUnwired = await prisma.financialAccount.findMany({
        where: { organizationId },
        select: { id: true, balance: true },
      });
      const parts = await createExpense({
        categoryId: unwired.id,
        amount: 75,
        date: new Date(),
        truckIds: [truck.id],
      });
      if (!parts.success) {
        record("expense with no account recorded", false, why(parts));
        return;
      }

      const balancesAfterUnwired = await prisma.financialAccount.findMany({
        where: { organizationId },
        select: { id: true, balance: true },
      });
      const noneMoved = balancesAfterUnwired.every((after) =>
        near(
          after.balance,
          balancesBeforeUnwired.find((before) => before.id === after.id)?.balance ?? NaN,
        ),
      );
      record(
        "one in a category with no account moves nothing, rather than half of it",
        noneMoved,
        noneMoved ? "every balance unchanged" : "a balance moved without an account being named",
      );

      // ------------------------------- 4. stock out → truck cost, no account
      const balancesBeforeStock = await prisma.financialAccount.findMany({
        where: { organizationId },
        select: { id: true, balance: true },
      });
      const truckBeforeStock = await getTruckCostBreakdown(organizationId, truck.id, range);

      const tookOut = await takeOutStock({
        inventoryItemId: item.id,
        quantity: 2,
        destination: truck.registrationNo,
        reason: `circle check ${RUN}`,
        truckId: truck.id,
        expenseCategoryId: unwired.id,
      });
      if (!tookOut.success) {
        record("stock taken out to a truck", false, why(tookOut));
        return;
      }
      record(
        "taking stock out to a truck posts what it is worth",
        near(tookOut.postedAmount ?? 0, 40),
        `posted ${tookOut.postedAmount} (2 × $20)`,
      );

      const stockExpense = await prisma.expense.findFirst({
        where: { organizationId, description: { contains: item.name } },
        select: { id: true, amount: true, quantity: true, unit: true, isPaid: true },
      });
      if (stockExpense) created.expenseIds.push(stockExpense.id);
      record(
        "as a real expense, with the quantity on it",
        Boolean(stockExpense) &&
          near(stockExpense!.amount, 40) &&
          stockExpense!.quantity === 2 &&
          stockExpense!.isPaid,
        stockExpense
          ? `$${stockExpense.amount}, ${stockExpense.quantity} ${stockExpense.unit}, paid ${stockExpense.isPaid}`
          : "no expense written",
      );

      const truckAfterStock = await getTruckCostBreakdown(organizationId, truck.id, range);
      record(
        "and the truck's costs go up by that much",
        near(truckAfterStock.expenses - truckBeforeStock.expenses, 40),
        `truck expenses ${truckBeforeStock.expenses} → ${truckAfterStock.expenses}`,
      );

      const inBreakdown = truckAfterStock.byCategory.find((row) => row.category === unwired.name);
      record(
        "and show up under the category it was posted to",
        Boolean(inBreakdown) && (inBreakdown!.amount ?? 0) >= 40,
        inBreakdown ? `${inBreakdown.category}: ${inBreakdown.amount}` : "category missing",
      );

      const balancesAfterStock = await prisma.financialAccount.findMany({
        where: { organizationId },
        select: { id: true, balance: true },
      });
      const stockMovedNoMoney = balancesAfterStock.every((after) =>
        near(
          after.balance,
          balancesBeforeStock.find((before) => before.id === after.id)?.balance ?? NaN,
        ),
      );
      record(
        "while no account is debited a second time (the cash left when the parts were bought)",
        stockMovedNoMoney,
        stockMovedNoMoney ? "every balance unchanged" : "an account was debited for consumed stock",
      );

      const movement = await prisma.stockMovement.findFirst({
        where: { inventoryItemId: item.id, type: "out" },
        orderBy: { createdAt: "desc" },
        select: { id: true, truckId: true, expenseId: true },
      });
      if (movement) created.movementIds.push(movement.id);
      record(
        "and the movement names the truck and the expense it created",
        movement?.truckId === truck.id && Boolean(movement?.expenseId),
        movement
          ? `truck ${movement.truckId === truck.id ? "linked" : "missing"}, expense ${movement.expenseId ?? "missing"}`
          : "no movement row",
      );

      // An expense can now name the account itself, rather than only
      // inheriting one from its category — "this tyre came out of petty cash".
      const pettyBefore =
        (await prisma.financialAccount.findUnique({ where: { id: petty.id } }))?.balance ?? 0;
      const fromPetty = await createExpense({
        categoryId: unwired.id, // a category with no account of its own
        amount: 45,
        date: new Date(),
        truckIds: [truck.id],
        accountId: petty.id,
      });
      if (!fromPetty.success) {
        record("expense paid from a named account", false, why(fromPetty));
        return;
      }
      const pettyAfter =
        (await prisma.financialAccount.findUnique({ where: { id: petty.id } }))?.balance ?? 0;
      record(
        "an expense can say which account it came out of, whatever its category",
        near(pettyBefore - pettyAfter, 45),
        `petty cash ${pettyBefore} → ${pettyAfter}`,
      );

      // -------------------- 6. an operations expense reaches the fleet
      const ops = await import("../../src/app/(dashboard)/operations/expenses/actions");

      const orphan = await ops.createExpense({
        amount: 60,
        date: new Date(),
        categoryId: unwired.id,
        description: `circle orphan ${RUN}`,
      });
      record(
        "an expense that belongs to nothing is refused, not left an orphan",
        !orphan.success,
        orphan.success ? "it was recorded, attached to nothing" : "refused",
      );

      const truckBeforeOps = await getTruckCostBreakdown(organizationId, truck.id, range);
      const shared = await ops.createExpense({
        amount: 100,
        date: new Date(),
        categoryId: unwired.id,
        description: `circle shared ${RUN}`,
        truckIds: [truck.id],
        tripIds: [trip.id, trip2.id],
      });
      if (!shared.success) {
        record("an operations expense can name a truck", false, why(shared));
        return;
      }
      const sharedId = "expense" in shared ? (shared.expense as { id: string }).id : null;

      const truckAfterOps = await getTruckCostBreakdown(organizationId, truck.id, range);
      record(
        "an expense recorded on the operations side reaches its truck",
        near(truckAfterOps.expenses - truckBeforeOps.expenses, 100),
        `truck expenses ${truckBeforeOps.expenses} → ${truckAfterOps.expenses}`,
      );

      if (sharedId) {
        await ops.updateExpense(sharedId, { amount: 120 });
        const tripLinks = await prisma.tripExpense.count({ where: { expenseId: sharedId } });
        const truckLinks = await prisma.truckExpense.count({ where: { expenseId: sharedId } });
        record(
          "and editing it keeps every link it had, not just the first",
          tripLinks === 2 && truckLinks === 1,
          `${tripLinks} trip link(s), ${truckLinks} truck link(s) after an amount change`,
        );
      }

      // ------------------------------- 5. a balance that can be repaired
      // The client's drift came from stored balances that nothing could put
      // back. Corrupt one on purpose and the repair has to find it.
      const { recomputeAccountBalances } = await import(
        "../../src/app/(dashboard)/finance/accounts/actions"
      );
      const correct =
        (await prisma.financialAccount.findUnique({ where: { id: bank.id } }))?.balance ?? 0;
      await prisma.financialAccount.update({
        where: { id: bank.id },
        data: { balance: correct + 999 },
      });

      const repair = await recomputeAccountBalances();
      const afterRepair =
        (await prisma.financialAccount.findUnique({ where: { id: bank.id } }))?.balance ?? 0;
      record(
        "a balance that disagrees with its ledger is repaired from it",
        // Not "exactly one repaired": run against a copy of a live database
        // this would also mend real drift, and that is the point of it.
        near(afterRepair, correct) && repair.repaired.length >= 1,
        `${correct + 999} → ${afterRepair} (expected ${correct}), ${repair.repaired.length} account(s) repaired`,
      );

      const again = await recomputeAccountBalances();
      record(
        "and a second pass over a sound ledger changes nothing",
        again.repaired.length === 0,
        `${again.checked} checked, ${again.repaired.length} repaired`,
      );

      // --------------------------- 7. reports that agree with each other
      // The same trip and the same truck, read through different reports. They
      // disagreed for years: one summed full expense amounts where another
      // split a shared cost, and the truck reports added a truck's own costs
      // to its trips' costs with no dedupe.
      const { fetchTripSummaryData, fetchTruckProfitabilityData } = await import(
        "../../src/lib/reports/data-fetchers"
      );
      const { fetchTripPnLData } = await import("../../src/lib/reports/operations-fetchers");

      const [summary, pnl] = await Promise.all([
        fetchTripSummaryData(organizationId, range.from, range.to),
        fetchTripPnLData(organizationId, range.from, range.to),
      ]);
      const summaryRow = summary.find(
        (row) => row.origin === "Harare" && row.destination === "Beitbridge",
      );
      const pnlRow = pnl.rows.find((row) => row.route === "Harare - Beitbridge");
      record(
        "the same trip shows the same profit in trip-summary and trip-pnl",
        Boolean(summaryRow && pnlRow) && near(summaryRow!.profit, pnlRow!.profit),
        `summary ${summaryRow?.profit} vs P&L ${pnlRow?.profit}`,
      );

      const [profitability, breakdown] = await Promise.all([
        fetchTruckProfitabilityData(organizationId, truck.id, range.from, range.to),
        getTruckCostBreakdown(organizationId, truck.id, range),
      ]);
      record(
        "and the same truck the same costs in truck-profitability and its own page",
        near(profitability.totalExpenses, breakdown.expenses),
        `report ${profitability.totalExpenses} vs page ${breakdown.expenses}`,
      );

      // A destination with no category — and no default on the item to fall
      // back to — is refused rather than losing the cost.
      const refused = await takeOutStock({
        inventoryItemId: uncosted.id,
        quantity: 1,
        destination: truck.registrationNo,
        reason: `circle check ${RUN}`,
        truckId: truck.id,
        expenseCategoryId: null,
      });
      record(
        "taking stock to a truck with no expense type is refused, not silently lost",
        !refused.success,
        refused.success ? "it went through and the cost vanished" : "refused",
      );
    });
  } finally {
    // ------------------------------------------------------------ clean up
    await prisma.stockMovement.deleteMany({ where: { inventoryItemId: { in: created.itemIds } } });
    await prisma.partAllocation.deleteMany({ where: { inventoryItemId: { in: created.itemIds } } });
    await prisma.payment.deleteMany({ where: { id: { in: created.paymentIds } } });
    await prisma.accountTransaction.deleteMany({
      where: { description: { contains: `circle check ${RUN}` } },
    });
    // By category rather than by collected id: an action that posts an expense
    // of its own accord — which is the whole point of this check — would
    // otherwise leave a row behind and block the truck's delete.
    await prisma.expense.deleteMany({ where: { categoryId: { in: created.categoryIds } } });
    await prisma.expense.deleteMany({ where: { id: { in: created.expenseIds } } });
    await prisma.invoice.deleteMany({ where: { id: { in: created.invoiceIds } } });
    await prisma.inventoryItem.deleteMany({ where: { id: { in: created.itemIds } } });
    await prisma.expenseCategory.deleteMany({ where: { id: { in: created.categoryIds } } });
    await prisma.trip.deleteMany({ where: { id: { in: created.tripIds } } });
    await prisma.driver.deleteMany({ where: { id: { in: created.driverIds } } });
    await prisma.customer.deleteMany({ where: { id: { in: created.customerIds } } });
    await prisma.truck.deleteMany({ where: { id: { in: created.truckIds } } });

    // `balance` is a stored figure, so removing the ledger rows above does not
    // put it back. Restore each account to what it was.
    for (const [id, balance] of balancesBefore) {
      await prisma.financialAccount.update({ where: { id }, data: { balance } });
    }
    await prisma.accountTransaction.deleteMany({
      where: { accountId: { in: [...balancesBefore.keys()] }, createdAt: { gte: new Date(Date.now() - 600_000) }, description: { contains: RUN } },
    });
  }

  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} circle checks passed${failed.length ? `, ${failed.length} failed` : ""}`,
  );
  if (failed.length) process.exit(1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
