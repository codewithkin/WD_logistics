/**
 * Can one admin lock the owner out of their own system?
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/tests/check-root-admin.ts
 *
 * Every admin used to be identical: any of them could set any other's
 * password, demote them, or delete them outright. Among equals that is fine.
 * For the owner's own account it is the whole business behind one bad day,
 * one borrowed laptop, or one misread name in a dropdown — and the account it
 * would take is the same one the reset button is built to leave standing, so
 * losing it loses the way back in as well.
 *
 * So one email is the root (src/lib/root-admin.ts). This holds the three
 * rules that make it mean something, and the one that stops it becoming a
 * prison: the root can still change its own password.
 *
 * Writes and undoes its own rows; safe on a development database.
 */

import { prisma } from "../../src/lib/prisma";
import { ROOT_ADMIN_EMAIL, isRootAdmin } from "../../src/lib/root-admin";
import { runAsActor } from "../../src/lib/acting-session";
import {
  removeMember,
  resetUserPassword,
  setUserPassword,
  updateMemberRole,
} from "../../src/app/(dashboard)/users/actions";

const checks: Array<{ name: string; ok: boolean; note: string }> = [];
function record(name: string, ok: boolean, note = "") {
  checks.push({ name, ok, note });
  console.log(`${ok ? "ok  " : "FAIL"} ${name.padEnd(52)} ${note}`);
}

const org = await prisma.organization.findFirst();
if (!org) {
  console.log("no organisation in the database — run bun run db:seed first");
  process.exit(1);
}

/** Make a member of the given role, with a credential row to change. */
async function makeUser(name: string, role: string) {
  const email = `root-check-${role}-${Date.now()}@wd.test`;
  const user = await prisma.user.create({
    data: {
      name,
      email,
      emailVerified: true,
      members: { create: { organizationId: org!.id, role } },
      accounts: {
        create: { accountId: email, providerId: "credential", password: "hash" },
      },
    },
    include: { members: true },
  });
  return { user, member: user.members[0]! };
}

// The root itself: created if this database has never seeded one.
let rootMember = await prisma.member.findFirst({
  where: { organizationId: org.id, user: { email: ROOT_ADMIN_EMAIL } },
  include: { user: true },
});
if (!rootMember) {
  const created = await prisma.user.create({
    data: {
      name: "Administrator",
      email: ROOT_ADMIN_EMAIL,
      emailVerified: true,
      members: { create: { organizationId: org.id, role: "admin" } },
      accounts: {
        create: {
          accountId: ROOT_ADMIN_EMAIL,
          providerId: "credential",
          password: "hash",
        },
      },
    },
  });
  rootMember = await prisma.member.findFirstOrThrow({
    where: { userId: created.id },
    include: { user: true },
  });
}

// The root's real password is not this test's to keep. Snapshotted before
// the "can change its own" case and put back at the end — a check that leaves
// the owner's account on a password only the transcript knows is worse than
// no check.
const rootCredentialBefore = await prisma.account.findFirst({
  where: { userId: rootMember.userId, providerId: "credential" },
  select: { id: true, password: true },
});

const other = await makeUser("Second Admin", "admin");

const sessionFor = (member: { id: string; userId: string }, user: { name: string; email: string }) =>
  ({
    user: { id: member.userId, name: user.name, email: user.email },
    role: "admin",
    organizationId: org.id,
    member: { id: member.id },
  }) as never;

const asOther = sessionFor(other.member, other.user);
const asRoot = sessionFor(rootMember, rootMember.user);

record(
  "the root is the email the deployment seeds",
  isRootAdmin(ROOT_ADMIN_EMAIL) && isRootAdmin(ROOT_ADMIN_EMAIL.toUpperCase()),
  `${ROOT_ADMIN_EMAIL}, matched case-insensitively`,
);

// ---- another admin cannot take the root's account -------------------------
{
  const attempt = await runAsActor(asOther, () =>
    setUserPassword(rootMember!.id, "NotYours#2026"),
  );
  record(
    "another admin cannot set the root's password",
    attempt.success === false && /only they can/i.test(attempt.error ?? ""),
    attempt.error ?? "it went through",
  );
}

{
  const attempt = await runAsActor(asOther, () => resetUserPassword(rootMember!.id));
  record(
    "nor generate a new one and read it in the email",
    attempt.success === false,
    attempt.error ?? "it went through",
  );
}

{
  const attempt = await runAsActor(asOther, () =>
    updateMemberRole(rootMember!.id, "staff"),
  );
  record(
    "nor demote it",
    attempt.success === false && /cannot be changed/i.test(attempt.error ?? ""),
    attempt.error ?? "it went through",
  );
}

{
  const attempt = await runAsActor(asOther, () => removeMember(rootMember!.id));
  record(
    "nor remove it",
    attempt.success === false && /cannot be removed/i.test(attempt.error ?? ""),
    attempt.error ?? "it went through",
  );
}

// ---- and the root is still an ordinary admin otherwise --------------------
{
  const attempt = await runAsActor(asRoot, () =>
    setUserPassword(rootMember!.id, "MyOwnChoice#2026"),
  );
  record(
    "the root can change its own password",
    attempt.success === true,
    attempt.success ? "which is the point — it is not locked out of itself" : (attempt.error ?? ""),
  );
}

{
  const attempt = await runAsActor(asRoot, () =>
    setUserPassword(other.member.id, "SetByRoot#2026"),
  );
  record(
    "and can still set everyone else's",
    attempt.success === true,
    attempt.success ? "" : (attempt.error ?? ""),
  );
}

{
  // Two ordinary admins are still equals: this is one account marked out,
  // not a rank above admin.
  const third = await makeUser("Third Admin", "admin");
  const attempt = await runAsActor(asOther, () =>
    setUserPassword(third.member.id, "AdminToAdmin#2026"),
  );
  record(
    "ordinary admins are still equals with each other",
    attempt.success === true,
    attempt.success ? "" : (attempt.error ?? ""),
  );
  await prisma.user.delete({ where: { id: third.user.id } }).catch(() => {});
}

await prisma.user.delete({ where: { id: other.user.id } }).catch(() => {});

if (rootCredentialBefore) {
  await prisma.account.update({
    where: { id: rootCredentialBefore.id },
    data: { password: rootCredentialBefore.password },
  });
  record(
    "the root's own password is put back afterwards",
    true,
    "this check does not leave it on one it chose",
  );
}

const failed = checks.filter((check) => !check.ok).length;
console.log(
  `\n${checks.length} checks, ${failed} failed.` +
    (failed === 0 ? " The owner's account cannot be taken from them." : ""),
);
process.exit(failed === 0 ? 0 : 1);
