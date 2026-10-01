/**
 * Destructive integration check for Settings → Reset Everything.
 *
 * Run only against a disposable database. The reset itself is real; WhatsApp
 * logout and object-storage deletes are stubbed, but database rows are not.
 */
import { prisma } from "../../src/lib/prisma";
import { ROOT_ADMIN_EMAIL } from "../../src/lib/root-admin";
import { runAsActor } from "../../src/lib/acting-session";
import { executeOrganizationReset } from "../../src/lib/reset-organization";

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

// ---- seeded administrator -------------------------------------------------
let rootMember = await prisma.member.findFirst({
  where: {
    organizationId: org.id,
    role: "admin",
    user: { email: { equals: ROOT_ADMIN_EMAIL, mode: "insensitive" } },
  },
  include: { user: true },
});

if (!rootMember) {
  const rootUser = await prisma.user.create({
    data: {
      name: "Administrator",
      email: ROOT_ADMIN_EMAIL,
      emailVerified: true,
      members: { create: { organizationId: org.id, role: "admin" } },
    },
  });
  rootMember = await prisma.member.findFirstOrThrow({
    where: { userId: rootUser.id, organizationId: org.id },
    include: { user: true },
  });
  console.log(`(created the root admin for this run: ${ROOT_ADMIN_EMAIL})`);
}

const actorFor = (member: NonNullable<typeof rootMember>) => ({
  user: {
    id: member.userId,
    name: member.user.name,
    email: member.user.email,
    image: null,
  },
  role: member.role,
  organizationId: org.id,
  member: { id: member.id },
}) as never;
const rootSession = actorFor(rootMember!);

// ---- an ordinary admin must be able to run it -----------------------------
let ordinaryAdmin = await prisma.member.findFirst({
  where: {
    organizationId: org.id,
    role: "admin",
    user: { email: { not: ROOT_ADMIN_EMAIL } },
  },
  include: { user: true },
});
if (!ordinaryAdmin) {
  const user = await prisma.user.create({
    data: {
      name: "Reset Test Admin",
      email: `reset-admin-${Date.now()}@wd.test`,
      emailVerified: true,
      members: { create: { organizationId: org.id, role: "admin" } },
    },
  });
  ordinaryAdmin = await prisma.member.findFirstOrThrow({
    where: { userId: user.id, organizationId: org.id },
    include: { user: true },
  });
}
const adminSession = actorFor(ordinaryAdmin!);

// ---- shared-database isolation fixture -----------------------------------
const suffix = Date.now().toString();
const foreignOrg = await prisma.organization.create({
  data: { name: "Reset isolation fixture", slug: `reset-isolation-${suffix}` },
});
const sharedUser = await prisma.user.create({
  data: {
    name: "Shared Membership Fixture",
    email: `reset-shared-${suffix}@wd.test`,
    emailVerified: true,
    members: {
      create: [
        { organizationId: org.id, role: "supervisor" },
        { organizationId: foreignOrg.id, role: "admin" },
      ],
    },
  },
});
await prisma.customer.create({
  data: { organizationId: foreignOrg.id, name: "Other organisation survives" },
});

// ---- data to erase ---------------------------------------------------------
await prisma.organization.update({
  where: { id: org.id },
  data: {
    name: "Practice company",
    bankDetails: "Practice banking details",
    vatNumber: "PRACTICE-VAT",
  },
});

const rootDbSessionToken = `reset-session-${suffix}`;
await prisma.session.create({
  data: {
    token: rootDbSessionToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    userId: rootMember!.userId,
  },
});
await prisma.whatsAppSession.upsert({
  where: { session: "agent-whatsapp" },
  create: {
    session: "agent-whatsapp",
    data: Buffer.from("reset-test-session"),
    sizeBytes: Buffer.byteLength("reset-test-session"),
  },
  update: {},
});

const stranger = await prisma.user.create({
  data: {
    name: "Someone Practising",
    email: `reset-check-${suffix}@wd.test`,
    emailVerified: true,
    members: { create: { organizationId: org.id, role: "supervisor" } },
    accounts: {
      create: { accountId: "x", providerId: "credential", password: "x" },
    },
  },
});

const phone = `+2637${suffix.slice(-8)}`;
const contact = await prisma.whatsAppContact.create({
  data: {
    organizationId: org.id,
    name: "Practice contact",
    phone,
    role: "staff",
    isActive: true,
  },
});
await prisma.whatsAppMessage.create({
  data: {
    organizationId: org.id,
    contactId: contact.id,
    direction: "inbound",
    phone,
    body: "practice conversation to remove",
  },
});
await prisma.employee.create({
  data: {
    organizationId: org.id,
    firstName: "Practice",
    lastName: "Employee",
    phone: `+263772${suffix.slice(-7)}`,
    position: "Clerk",
  },
});
await prisma.customer.create({
  data: { organizationId: org.id, name: "Practice customer" },
});
await prisma.expenseCategory.create({
  data: { organizationId: org.id, name: "Practice category", kind: "fuel" },
});
await prisma.financialAccount.create({
  data: {
    organizationId: org.id,
    name: "Practice bank",
    type: "bank",
    balance: 0,
    startingBalance: 0,
  },
});

const before = {
  contacts: await prisma.whatsAppContact.count({ where: { organizationId: org.id } }),
  employees: await prisma.employee.count({ where: { organizationId: org.id } }),
  customers: await prisma.customer.count({ where: { organizationId: org.id } }),
};
record(
  "there is something to reset",
  before.contacts > 0 && before.employees > 0 && before.customers > 0,
  `${before.customers} customers, ${before.contacts} assistant contacts`,
);

const noFileDelete = async () => ({ success: true });
const noActualLogout = async () => ({
  success: true as const,
  toldWhatsApp: true,
  message: "test logout",
});

// ---- fail closed if the agent cannot revoke pairing -----------------------
{
  const refused = await runAsActor(adminSession, () =>
    executeOrganizationReset("DELETE ALL DATA", {
      revokePairing: async () => ({ success: false, error: "agent offline" }),
      deleteFile: noFileDelete,
    }),
  );
  record(
    "an admin reaches the pairing-revoke step",
    refused.success === false && /agent offline/.test(refused.error ?? ""),
    refused.error ?? "the reset did not stop at the pairing step",
  );
  record(
    "no records are removed if pairing revocation fails",
    (await prisma.customer.count({ where: { organizationId: org.id } })) > 0 &&
      (await prisma.whatsAppContact.count({ where: { organizationId: org.id } })) > 0,
    "customer and WhatsApp contact still present",
  );
}

// ---- the wrong confirmation is refused ------------------------------------
{
  const refused = await runAsActor(rootSession, () =>
    executeOrganizationReset("delete all data", {
      revokePairing: async () => {
        throw new Error("should not reach agent logout");
      },
      deleteFile: noFileDelete,
    }),
  );
  record(
    "the confirmation is exact",
    refused.success === false && /exactly/.test(refused.error ?? ""),
    refused.error ?? "lower case was accepted",
  );
  record(
    "nothing was deleted on the way to refusing",
    (await prisma.customer.count({ where: { organizationId: org.id } })) > 0,
    "the practice customer is still there",
  );
}

// ---- the real reset, initiated by an ordinary admin -----------------------
let logoutCalled = false;
const result = await runAsActor(adminSession, () =>
  executeOrganizationReset("DELETE ALL DATA", {
    revokePairing: async () => {
      logoutCalled = true;
      return noActualLogout();
    },
    deleteFile: noFileDelete,
  }),
);
record(
  "any admin can run the reset",
  result.success === true,
  result.success ? `${result.deleted} records removed` : (result.error ?? ""),
);
record("the agent logout was requested", logoutCalled, "QR re-pair is required");

// ---- what must be gone -----------------------------------------------------
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
  contacts: await prisma.whatsAppContact.count({ where: { organizationId: org.id } }),
  messages: await prisma.whatsAppMessage.count({ where: { organizationId: org.id } }),
  categories: await prisma.expenseCategory.count({ where: { organizationId: org.id } }),
  financialAccounts: await prisma.financialAccount.count({ where: { organizationId: org.id } }),
};
const leftBehind = Object.entries(remaining).filter(([, count]) => count > 0);
record(
  "every kind of organisation record is gone",
  leftBehind.length === 0,
  leftBehind.length === 0
    ? `${Object.keys(remaining).length} tables checked, all empty`
    : leftBehind.map(([name, count]) => `${name}: ${count}`).join(", "),
);

// ---- only the seeded administrator survives in this organisation ----------
const targetMembers = await prisma.member.findMany({
  where: { organizationId: org.id },
  include: { user: true },
});
record(
  "the seeded admin remains the only organisation member",
  targetMembers.length === 1 &&
    targetMembers[0]!.user.email.toLowerCase() === ROOT_ADMIN_EMAIL.toLowerCase() &&
    targetMembers[0]!.role === "admin",
  targetMembers.map((member) => `${member.user.email} (${member.role})`).join(", "),
);

const strangerGone = await prisma.user.findUnique({ where: { id: stranger.id } });
record(
  "the practice-only account and credentials are gone",
  strangerGone === null &&
    (await prisma.account.count({ where: { userId: stranger.id } })) === 0,
  "credentials, sessions and memberships go with the user row",
);
record(
  "the shared user's account survives through its other membership",
  Boolean(await prisma.user.findUnique({ where: { id: sharedUser.id } })) &&
    (await prisma.member.count({ where: { organizationId: foreignOrg.id, userId: sharedUser.id } })) === 1,
  "only the target-organisation membership is removed",
);
record(
  "the other organisation's customer survives",
  (await prisma.customer.count({ where: { organizationId: foreignOrg.id } })) === 1,
  "the target reset is scoped to its organization ID",
);

const settingsAfter = await prisma.organization.findUniqueOrThrow({
  where: { id: org.id },
  select: { name: true, logo: true, metadata: true, bankDetails: true, vatNumber: true },
});
record(
  "company profile and settings are cleared",
  settingsAfter.name === "" &&
    settingsAfter.logo === null &&
    settingsAfter.metadata === null &&
    settingsAfter.bankDetails === null &&
    settingsAfter.vatNumber === null,
  "only the minimal organization row needed for sign-in remains",
);
record(
  "no default categories or accounts are recreated",
  (await prisma.expenseCategory.count({ where: { organizationId: org.id } })) === 0 &&
    (await prisma.financialAccount.count({ where: { organizationId: org.id } })) === 0,
  "the reset remains empty instead of silently restoring demo defaults",
);
record(
  "the WhatsApp pairing row is removed",
  (await prisma.whatsAppSession.count()) === 0,
  "the next WhatsApp connection requires a QR scan",
);
record(
  "assistant memory cleanup completed",
  result.success === true && result.assistantMemoryCleared,
  "organization-prefixed and matching legacy conversations",
);

// Remove the temporary isolation fixture after all cross-organization checks.
await prisma.organization.delete({ where: { id: foreignOrg.id } });
await prisma.user.deleteMany({ where: { id: sharedUser.id, members: { none: {} } } });

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0 ? " Reset semantics match the confirmed scope." : ""),
);
process.exit(failed === 0 ? 0 : 1);
