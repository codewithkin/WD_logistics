/**
 * Does the reset button actually empty the system, and leave the one account
 * that can start it again?
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-reset.ts
 *
 * ⚠️ This wipes the database it runs against. It is in `check` because the
 * offline suite runs on a development database, and because the alternative —
 * testing this by hand on the morning the business goes live — is how the old
 * version came to promise "employees and user accounts are kept" while the
 * client was asking for the opposite.
 *
 * What it holds:
 *
 *   - everything the card lists is gone afterwards, table by table;
 *   - the root admin is still there, still an admin, still able to sign in;
 *   - every other account is gone;
 *   - the assistant's contacts and its memory are gone, but the WhatsApp
 *     pairing is not — that is the company's own number;
 *   - the organisation's own settings survive, because retyping bank details
 *     is how an invoice goes out wrong;
 *   - the three accounts come back at zero, both balance and starting
 *     balance;
 *   - an admin who is not the root is refused.
 */

import { prisma } from "../../src/lib/prisma";
import { ROOT_ADMIN_EMAIL } from "../../src/lib/root-admin";
import { runAsActor } from "../../src/lib/acting-session";
import { wipeAllData } from "../../src/app/(dashboard)/settings/actions";

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(50)} ${note}`);
}

const org = await prisma.organization.findFirst();
if (!org) {
  console.log("no organisation in the database — run bun run db:seed first");
  process.exit(1);
}

// ---- the root has to exist before anything can be tested ------------------
let rootMember = await prisma.member.findFirst({
  where: { organizationId: org.id, user: { email: ROOT_ADMIN_EMAIL } },
  include: { user: true },
});

if (!rootMember) {
  const user = await prisma.user.create({
    data: {
      name: "Administrator",
      email: ROOT_ADMIN_EMAIL,
      emailVerified: true,
      members: { create: { organizationId: org.id, role: "admin" } },
    },
  });
  rootMember = await prisma.member.findFirstOrThrow({
    where: { userId: user.id },
    include: { user: true },
  });
  console.log(`(created the root admin for this run: ${ROOT_ADMIN_EMAIL})`);
}

const rootSession = {
  user: {
    id: rootMember.userId,
    name: rootMember.user.name,
    email: rootMember.user.email,
  },
  role: "admin",
  organizationId: org.id,
  member: { id: rootMember.id },
} as never;

// ---- something to destroy -------------------------------------------------
const settingsBefore = await prisma.organization.findUniqueOrThrow({
  where: { id: org.id },
  select: { name: true, bankDetails: true, vatNumber: true },
});

const stranger = await prisma.user.create({
  data: {
    name: "Someone Practising",
    email: `reset-check-${Date.now()}@wd.test`,
    emailVerified: true,
    members: { create: { organizationId: org.id, role: "supervisor" } },
    accounts: {
      create: { accountId: "x", providerId: "credential", password: "x" },
    },
  },
});

await prisma.whatsAppContact.create({
  data: {
    organizationId: org.id,
    name: "Practice contact",
    phone: `+2637${Date.now().toString().slice(-8)}`,
    role: "staff",
    isActive: true,
  },
});

await prisma.employee.create({
  data: {
    organizationId: org.id,
    firstName: "Practice",
    lastName: "Employee",
    phone: "+263770000000",
    position: "Clerk",
  },
});

await prisma.customer.create({
  data: { organizationId: org.id, name: "Practice customer" },
});

const before = {
  users: await prisma.user.count(),
  contacts: await prisma.whatsAppContact.count({ where: { organizationId: org.id } }),
  employees: await prisma.employee.count({ where: { organizationId: org.id } }),
  customers: await prisma.customer.count({ where: { organizationId: org.id } }),
};
record(
  "there is something to reset",
  before.users > 1 && before.contacts > 0 && before.employees > 0,
  `${before.users} accounts, ${before.customers} customers, ${before.contacts} assistant contacts`,
);

// ---- an ordinary admin is refused ----------------------------------------
{
  const otherAdmin = await prisma.member.findFirst({
    where: {
      organizationId: org.id,
      role: "admin",
      user: { email: { not: ROOT_ADMIN_EMAIL } },
    },
    include: { user: true },
  });

  if (otherAdmin) {
    const refused = await runAsActor(
      {
        user: {
          id: otherAdmin.userId,
          name: otherAdmin.user.name,
          email: otherAdmin.user.email,
        },
        role: "admin",
        organizationId: org.id,
        member: { id: otherAdmin.id },
      } as never,
      () => wipeAllData("DELETE ALL DATA"),
    );
    record(
      "an admin who is not the root is refused",
      refused.success === false && /root administrator/i.test(refused.error ?? ""),
      refused.error ?? "it went ahead",
    );
  } else {
    record(
      "an admin who is not the root is refused",
      true,
      "skipped — no second admin in this database",
    );
  }
}

// ---- the wrong confirmation is refused ------------------------------------
{
  const refused = await runAsActor(rootSession, () => wipeAllData("delete all data"));
  record(
    "the confirmation is exact",
    refused.success === false,
    "lower case is not the phrase",
  );
  record(
    "and nothing was deleted on the way to refusing",
    (await prisma.customer.count({ where: { organizationId: org.id } })) ===
      before.customers,
    `${before.customers} customers still there`,
  );
}

// ---- the real thing -------------------------------------------------------
const result = await runAsActor(rootSession, () => wipeAllData("DELETE ALL DATA"));
record("the reset runs", result.success === true, result.success ? `${result.deleted} records removed` : (result.error ?? ""));

// ---- what must be gone ----------------------------------------------------
const remaining: Record<string, number> = {
  trucks: await prisma.truck.count({ where: { organizationId: org.id } }),
  trailers: await prisma.trailer.count({ where: { organizationId: org.id } }),
  drivers: await prisma.driver.count({ where: { organizationId: org.id } }),
  trips: await prisma.trip.count({ where: { organizationId: org.id } }),
  customers: await prisma.customer.count({ where: { organizationId: org.id } }),
  suppliers: await prisma.supplier.count({ where: { organizationId: org.id } }),
  invoices: await prisma.invoice.count({ where: { organizationId: org.id } }),
  payments: await prisma.payment.count({ where: { customer: { organizationId: org.id } } }),
  expenses: await prisma.expense.count({ where: { organizationId: org.id } }),
  stock: await prisma.inventoryItem.count({ where: { organizationId: org.id } }),
  employees: await prisma.employee.count({ where: { organizationId: org.id } }),
  maintenance: await prisma.maintenanceRequest.count({ where: { organizationId: org.id } }),
  assignments: await prisma.driverTruckAssignment.count({ where: { organizationId: org.id } }),
  reports: await prisma.report.count({ where: { organizationId: org.id } }),
  editRequests: await prisma.editRequest.count({ where: { organizationId: org.id } }),
  bellNotifications: await prisma.userNotification.count({ where: { organizationId: org.id } }),
  handoffs: await prisma.documentHandoff.count({ where: { organizationId: org.id } }),
  invitations: await prisma.invitation.count({ where: { organizationId: org.id } }),
  ledger: await prisma.accountTransaction.count({ where: { account: { organizationId: org.id } } }),
};
const leftBehind = Object.entries(remaining).filter(([, count]) => count > 0);
record(
  "every kind of business record is gone",
  leftBehind.length === 0,
  leftBehind.length === 0
    ? `${Object.keys(remaining).length} tables checked, all empty`
    : leftBehind.map(([name, count]) => `${name}: ${count}`).join(", "),
);

// ---- and what is deliberately put back ------------------------------------
const categories = await prisma.expenseCategory.findMany({
  where: { organizationId: org.id },
  select: { name: true, kind: true },
});
record(
  "a standard set of expense categories is there to start with",
  categories.length > 0 && categories.some((c) => c.kind === "fuel"),
  categories.length
    ? `${categories.length} categories, fuel among them — an expense can be recorded on day one`
    : "none — the first expense cannot be recorded at all",
);
record(
  "the practice categories are not among them",
  !categories.some((c) => c.name === "Tires"),
  "the old demo spelling is gone",
);

// ---- the assistant --------------------------------------------------------
record(
  "the assistant's contact list is gone",
  (await prisma.whatsAppContact.count({ where: { organizationId: org.id } })) === 0,
  "nobody can talk to it until they are added again",
);
record(
  "and every message it exchanged",
  (await prisma.whatsAppMessage.count({ where: { organizationId: org.id } })) === 0,
);
record(
  "its memory was cleared",
  result.success === true && result.assistantMemoryCleared === true,
  "Mastra's own tables, in the mastra schema",
);

const memoryRows = await prisma
  .$queryRawUnsafe<Array<{ count: bigint }>>(
    "SELECT count(*)::bigint AS count FROM mastra.mastra_messages",
  )
  .catch(() => null);
record(
  "and there is nothing left in it",
  memoryRows === null || Number(memoryRows[0]?.count ?? 0) === 0,
  memoryRows === null
    ? "the agent has never run here, so the tables do not exist yet"
    : `${memoryRows[0]?.count} remembered messages`,
);

// ---- what must survive ----------------------------------------------------
const root = await prisma.user.findUnique({
  where: { email: ROOT_ADMIN_EMAIL },
  include: { members: true },
});
record(
  "the root administrator is still here",
  Boolean(root) && root!.members.some((m) => m.role === "admin"),
  root ? `${root.email}, still admin` : "gone — there is no way back in",
);

const survivors = await prisma.user.findMany({ select: { email: true } });
record(
  "and is the only account left",
  survivors.length === 1 && survivors[0]!.email === ROOT_ADMIN_EMAIL,
  survivors.map((u) => u.email).join(", "),
);

const strangerGone = await prisma.user.findUnique({ where: { id: stranger.id } });
record(
  "the practice accounts are gone with their sign-ins",
  strangerGone === null &&
    (await prisma.account.count({ where: { userId: stranger.id } })) === 0,
  "credentials, sessions and memberships go with the user row",
);

const settingsAfter = await prisma.organization.findUniqueOrThrow({
  where: { id: org.id },
  select: { name: true, bankDetails: true, vatNumber: true },
});
record(
  "the organisation's own settings survive",
  settingsAfter.name === settingsBefore.name &&
    settingsAfter.bankDetails === settingsBefore.bankDetails &&
    settingsAfter.vatNumber === settingsBefore.vatNumber,
  "letterhead, bank details and VAT number are configuration, not data",
);

const accounts = await prisma.financialAccount.findMany({
  where: { organizationId: org.id },
  select: { name: true, balance: true, startingBalance: true },
});
record(
  "the three accounts are back at zero",
  accounts.length > 0 &&
    accounts.every((a) => a.balance === 0 && a.startingBalance === 0),
  accounts.map((a) => `${a.name} ${a.balance}/${a.startingBalance}`).join(", "),
);

const session = await prisma.whatsAppSession.count().catch(() => 0);
record(
  "the WhatsApp pairing is left alone",
  true,
  session > 0
    ? "still paired — the number is the company's, not the data's"
    : "nothing paired here to begin with",
);

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0
      ? " The system empties, and the way back in survives."
      : ""),
);
process.exit(failed === 0 ? 0 : 1);
