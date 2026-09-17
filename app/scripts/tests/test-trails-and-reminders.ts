// Backend tests for: configurable expiry reminders (rules, storage, cron job),
// account money in/out entries, and the stock take-out concurrency guard.
//
// Runs against the real dev DATABASE_URL using the app's own library code.
// Creates an isolated organization + user and removes everything it created.
// AGENT_URL is forced to a dead port so the cron job can never send a real
// WhatsApp message during the test.
//
// Usage: bun scripts/tests/test-trails-and-reminders.ts

process.env.AGENT_URL = "http://127.0.0.1:9";
process.env.CRON_SECRET = "test-secret";

const { prisma } = await import("@/lib/prisma");
const { normalizeReminderDays, shouldSendExpiryReminder, DEFAULT_REMINDER_DAYS } = await import("@/lib/expiry-reminders");
const { replaceExpiryReminders, getExpiryReminders, deleteExpiryReminders } = await import("@/lib/expiry-reminders-server");
const { ensureAccountsExist, recordManualMovement } = await import("@/lib/accounts-server");
const { InsufficientBalanceError, isDebitTransaction } = await import("@/lib/accounts");
const { GET: runExpiryCron } = await import("@/app/api/cron/document-expiry-reminders/route");

const RUN_ID = Date.now().toString(36);
let passed = 0;
const failures: string[] = [];

function check(condition: unknown, message: string) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failures.push(message);
    console.log(`  ❌ ${message}`);
  }
}

const sameArray = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i]);

console.log(`\n=== Trails & reminders test run (${RUN_ID}) ===\n`);

console.log("-- reminder rules (pure) --");
check(sameArray(normalizeReminderDays([7, 30, 30, 0, -2, 400, 2.5, 14]), [30, 14, 7]), "normalize dedupes, drops invalid, sorts desc");
check(shouldSendExpiryReminder(30, []), "default schedule fires at 30 days when nothing configured");
check(!shouldSendExpiryReminder(9, []), "default schedule does not fire at 9 days");
check(shouldSendExpiryReminder(9, [9, 45]), "custom schedule fires on a configured day");
check(!shouldSendExpiryReminder(30, [9, 45]), "custom schedule replaces the defaults (30 no longer fires)");
check(shouldSendExpiryReminder(0, [9]), "expiry day always fires");
check(shouldSendExpiryReminder(-14, [9]) && !shouldSendExpiryReminder(-3, [9]), "overdue fires weekly only");
check(DEFAULT_REMINDER_DAYS.includes(30), "default schedule exposed for the UI hint");

const organization = await prisma.organization.create({
  data: { name: `Test Org ${RUN_ID}`, slug: `test-org-${RUN_ID}` },
});
const user = await prisma.user.create({
  data: { name: `Tester ${RUN_ID}`, email: `tester-${RUN_ID}@example.test`, emailVerified: true },
});

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};
const inDays = (n: number) => new Date(startOfToday().getTime() + n * 24 * 60 * 60 * 1000);

let truckId = "";
let trailerId = "";

try {
  console.log("\n-- reminder storage --");
  const truck = await prisma.truck.create({
    data: {
      organizationId: organization.id,
      registrationNo: `REM-${RUN_ID}`,
      make: "Test",
      model: "Truck",
      year: 2020,
      vehicleLicenseExpiration: inDays(9),
      crossBorderPermitExpiration: inDays(9),
    },
  });
  truckId = truck.id;

  await prisma.$transaction((tx) =>
    replaceExpiryReminders(tx, {
      organizationId: organization.id,
      entityType: "truck",
      entityId: truck.id,
      reminders: { vehicleLicenseExpiration: [9, 60, 60, 0, 500], notARealField: [5] },
    })
  );
  let stored = await getExpiryReminders(organization.id, "truck", truck.id);
  check(sameArray(stored.vehicleLicenseExpiration ?? [], [60, 9]), "stores normalized days for a tracked field");
  check(!("notARealField" in stored), "ignores fields that aren't tracked for the entity type");

  await prisma.$transaction((tx) =>
    replaceExpiryReminders(tx, {
      organizationId: organization.id,
      entityType: "truck",
      entityId: truck.id,
      reminders: { vehicleLicenseExpiration: [9], crossBorderPermitExpiration: [] },
    })
  );
  stored = await getExpiryReminders(organization.id, "truck", truck.id);
  check(sameArray(stored.vehicleLicenseExpiration ?? [], [9]), "replacing overwrites the previous days (multiple → one)");
  check(!stored.crossBorderPermitExpiration, "an empty list means default schedule (no rows)");

  const trailer = await prisma.trailer.create({
    data: {
      organizationId: organization.id,
      registrationNo: `TRL-${RUN_ID}`,
      make: "Test",
      model: "Trailer",
      year: 2021,
      licenseExpiration: inDays(30),
    },
  });
  trailerId = trailer.id;

  console.log("\n-- cron job end-to-end --");
  const response = await runExpiryCron(
    new Request("http://localhost/api/cron/document-expiry-reminders", {
      headers: { authorization: "Bearer test-secret" },
    }) as never
  );
  const body = await response.json();
  check(body.success === true, "cron job completes");

  const logged = await prisma.notification.findMany({
    where: { type: "document_expiry", createdAt: { gte: startOfToday() } },
    select: { id: true, metadata: true },
  });
  const forEntity = (entityId: string, field: string) =>
    logged.filter((n) => {
      const m = n.metadata as { entityId?: string; documentType?: string };
      return m?.entityId === entityId && m?.documentType === field;
    });

  check(forEntity(truck.id, "vehicleLicenseExpiration").length === 1, "custom 9-day reminder fired for the vehicle license");
  check(forEntity(truck.id, "crossBorderPermitExpiration").length === 0, "9 days out with defaults did not fire for the permit");
  check(forEntity(trailer.id, "licenseExpiration").length === 1, "trailer licenses are now covered (30-day default fired)");

  await runExpiryCron(
    new Request("http://localhost/api/cron/document-expiry-reminders", {
      headers: { authorization: "Bearer test-secret" },
    }) as never
  );
  const afterRerun = await prisma.notification.count({
    where: {
      type: "document_expiry",
      createdAt: { gte: startOfToday() },
      metadata: { path: ["entityId"], equals: truck.id },
    },
  });
  check(afterRerun === 1, "re-running the same day doesn't send a duplicate");

  const unauthorized = await runExpiryCron(new Request("http://localhost/api/cron/document-expiry-reminders") as never);
  check(unauthorized.status === 401, "cron job rejects calls without the secret");

  await prisma.notification.deleteMany({ where: { id: { in: logged.filter((n) => {
    const m = n.metadata as { entityId?: string };
    return m?.entityId === truck.id || m?.entityId === trailer.id;
  }).map((n) => n.id) } } });

  await prisma.$transaction((tx) => deleteExpiryReminders(tx, "truck", truck.id));
  check((await prisma.expiryReminder.count({ where: { entityId: truck.id } })) === 0, "delete helper removes an entity's reminders");

  console.log("\n-- account money in / out --");
  await ensureAccountsExist(organization.id);
  const petty = await prisma.financialAccount.findUniqueOrThrow({
    where: { organizationId_type: { organizationId: organization.id, type: "petty_cash" } },
  });

  await recordManualMovement({ accountId: petty.id, type: "deposit", amount: 100, description: "Float handed over", createdById: user.id });
  await recordManualMovement({ accountId: petty.id, type: "withdrawal", amount: 30.5, description: "Fuel advance", createdById: user.id });

  let account = await prisma.financialAccount.findUniqueOrThrow({ where: { id: petty.id } });
  check(Math.abs(account.balance - 69.5) < 0.001, "deposit then withdrawal leaves 69.50");

  let overdrawBlocked = false;
  try {
    await recordManualMovement({ accountId: petty.id, type: "withdrawal", amount: 1000, description: "Too much", createdById: user.id });
  } catch (err) {
    overdrawBlocked = err instanceof InsufficientBalanceError;
  }
  account = await prisma.financialAccount.findUniqueOrThrow({ where: { id: petty.id } });
  check(overdrawBlocked, "withdrawal larger than the balance is refused");
  check(Math.abs(account.balance - 69.5) < 0.001, "refused withdrawal leaves the balance untouched");

  const ledger = await prisma.accountTransaction.findMany({ where: { accountId: petty.id }, orderBy: { createdAt: "asc" } });
  check(ledger.length === 2, "exactly two ledger entries recorded (refused one isn't logged)");
  check(ledger[0].type === "deposit" && ledger[0].balanceAfter === 100, "deposit entry has correct running balance");
  check(ledger[1].type === "withdrawal" && Math.abs(ledger[1].balanceAfter - 69.5) < 0.001, "withdrawal entry has correct running balance");
  check(ledger.every((t) => t.createdById === user.id && t.description), "every entry records who and why");
  check(isDebitTransaction("withdrawal") && !isDebitTransaction("deposit"), "withdrawals count as money out in reports");

  console.log("\n-- stock take-out concurrency guard --");
  const item = await prisma.inventoryItem.create({
    data: { organizationId: organization.id, name: "Engine Oil", unit: "litre", quantity: 10 },
  });
  const takeOut = (qty: number) =>
    prisma.inventoryItem.updateMany({
      where: { id: item.id, quantity: { gte: qty } },
      data: { quantity: { decrement: qty } },
    });
  const results = await Promise.all([takeOut(6), takeOut(6)]);
  const finalItem = await prisma.inventoryItem.findUniqueOrThrow({ where: { id: item.id } });
  check(results.filter((r) => r.count === 1).length === 1, "only one of two simultaneous 6-litre take-outs succeeds");
  check(finalItem.quantity === 4, "stock never goes negative (10 → 4)");

  await prisma.stockMovement.create({
    data: {
      organizationId: organization.id,
      inventoryItemId: item.id,
      type: "out",
      quantity: 6,
      quantityBefore: 10,
      quantityAfter: 4,
      destination: "Workshop",
      reason: "Service",
      performedById: user.id,
    },
  });
  const movement = await prisma.stockMovement.findFirst({ where: { inventoryItemId: item.id }, include: { performedBy: true } });
  check(movement?.destination === "Workshop" && movement.performedBy.id === user.id, "movement stores where, why and who");
} finally {
  console.log("\n-- cleanup --");
  await prisma.expiryReminder.deleteMany({ where: { organizationId: organization.id } });
  await prisma.stockMovement.deleteMany({ where: { organizationId: organization.id } });
  await prisma.accountTransaction.deleteMany({ where: { createdById: user.id } });
  if (truckId) await prisma.truck.deleteMany({ where: { id: truckId } });
  if (trailerId) await prisma.trailer.deleteMany({ where: { id: trailerId } });
  await prisma.organization.delete({ where: { id: organization.id } });
  await prisma.user.delete({ where: { id: user.id } });
  console.log("  test organization, user and fixtures removed");
}

console.log(`\n=== Results: ${passed} passed, ${failures.length} failed ===\n`);
await prisma.$disconnect();
if (failures.length > 0) {
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
