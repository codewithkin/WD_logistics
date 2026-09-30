/**
 * Does a notification carry a figure its recipient may not see?
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-notification-money.ts
 *
 * The bell was the way round the whole access model. A trip's creation is a
 * tier-3 event aimed at supervisors, and the trip's revenue travelled in the
 * notification's metadata — written into the supervisor's own row, in their
 * own org, where the bell renders it. Every page, every export and every
 * assistant tool was gated; the notification about the page was not.
 *
 * So this creates a real notification for each entity that carries money,
 * reads the rows back per recipient, and fails on an earnings figure landing
 * anywhere but an admin. It writes to the dev database and deletes what it
 * wrote.
 */

import { prisma } from "../../src/lib/prisma";
import {
  notifyTripCreated,
  notifyTripUpdated,
  notifyExpenseCreated,
  notifyInvoiceCreated,
  notifyPaymentCreated,
} from "../../src/lib/notifications";

/** ACCESS_CONTROL.md: revenue, profit and margin are admin, anywhere. */
const EARNINGS = ["revenue", "profit", "margin", "salary"];

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(46)} ${note}`);
}

const org = await prisma.organization.findFirst({ select: { id: true } });
if (!org) {
  console.log("no organisation in the database — run bun run db:seed first");
  process.exit(1);
}

const members = await prisma.member.findMany({
  where: { organizationId: org.id },
  select: { userId: true, role: true, user: { select: { name: true, email: true } } },
});
const admin = members.find((m) => m.role === "admin");
const supervisor = members.find((m) => m.role === "supervisor");
if (!admin || !supervisor) {
  console.log("needs an admin and a supervisor — run bun prisma/dev-fixtures.ts");
  process.exit(1);
}

/** The performer is excluded from their own notifications, so act as neither. */
const actor = { name: "audit", email: "audit@wd.test", role: "staff" };

const marker = `notif-money-check-${Date.now()}`;
const since = new Date();

await notifyTripCreated(
  {
    id: marker,
    origin: "Mutare",
    destination: "Beira",
    scheduledDate: new Date(),
    truckRegistration: "ABC 222",
    driverName: "Tendai",
    customerName: "Farm Co",
    revenue: 4200,
    status: "scheduled",
  },
  org.id,
  actor,
);

await notifyTripUpdated(
  {
    id: marker,
    origin: "Mutare",
    destination: "Beira",
    scheduledDate: new Date(),
    truckRegistration: "ABC 222",
    driverName: "Tendai",
    revenue: 4200,
    status: "completed",
  },
  org.id,
  actor,
);

await notifyExpenseCreated(
  { id: marker, description: "Diesel", category: "Fuel", amount: 640, date: new Date() },
  org.id,
  actor,
);

await notifyInvoiceCreated(
  { id: marker, invoiceNumber: "INV-TEST", customerName: "Farm Co", amount: 4200, status: "sent" },
  org.id,
  actor,
);

await notifyPaymentCreated(
  { id: marker, paymentNumber: "PMT-TEST", customerName: "Farm Co", amount: 4200, method: "cash" },
  org.id,
  actor,
);

const rows = await prisma.userNotification.findMany({
  where: { organizationId: org.id, entityId: marker, createdAt: { gte: since } },
  select: { id: true, userId: true, type: true, title: true, metadata: true },
});

record(
  "the notifications were written",
  rows.length > 0,
  `${rows.length} rows across ${new Set(rows.map((r) => r.userId)).size} people`,
);

const roleOf = new Map(members.map((m) => [m.userId, m.role]));
const offences: string[] = [];
let supervisorRows = 0;

for (const row of rows) {
  const role = roleOf.get(row.userId) ?? "unknown";
  if (role === "supervisor") supervisorRows += 1;
  if (role === "admin") continue;
  const keys = Object.keys((row.metadata ?? {}) as Record<string, unknown>);
  const bad = keys.filter((key) => EARNINGS.some((word) => key.toLowerCase().includes(word)));
  if (bad.length > 0) offences.push(`${row.type} → ${role}: ${bad.join(", ")}`);
}

record(
  "a supervisor was actually notified",
  supervisorRows > 0,
  supervisorRows === 0 ? "nothing reached them — the check below proves nothing" : `${supervisorRows} rows`,
);

record(
  "no earnings figure reaches a non-admin",
  offences.length === 0,
  offences.length === 0 ? "revenue, profit, margin and salary all absent" : offences.join(" | "),
);

// The admin keeps theirs — a redaction that hides it from everybody is a
// different bug, and this is the half that would pass silently.
const adminRows = rows.filter((row) => roleOf.get(row.userId) === "admin");
const adminHasRevenue = adminRows.some((row) =>
  Object.keys((row.metadata ?? {}) as Record<string, unknown>).some((key) =>
    key.toLowerCase().includes("revenue"),
  ),
);
record(
  "the admin still gets the figure",
  adminRows.length === 0 || adminHasRevenue,
  adminRows.length === 0 ? "no admin row (admins are excluded from tier 3)" : "revenue present",
);

// An expense amount is a supervisor's own record and must NOT be stripped.
const supervisorExpense = rows.find(
  (row) => row.type === "expense" && roleOf.get(row.userId) === "supervisor",
);
record(
  "an expense amount still reaches a supervisor",
  !supervisorExpense ||
    Object.keys((supervisorExpense.metadata ?? {}) as Record<string, unknown>).includes("amount"),
  supervisorExpense ? "they record these, so they see them" : "no supervisor expense row",
);

await prisma.userNotification.deleteMany({ where: { entityId: marker } });

const failed = checks.filter((check) => !check.ok).length;
console.log(`\n${checks.length} checks, ${failed} failed.`);
process.exit(failed === 0 ? 0 : 1);
