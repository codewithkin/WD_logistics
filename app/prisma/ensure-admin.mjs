// Idempotent admin bootstrap — safe to run on every container start.
//
// Unlike prisma/seed.ts (which deletes and regenerates ALL demo data every
// run — trucks, trips, customers, etc. — and is meant for populating a fresh
// dev database), this script only ensures one organization and one admin
// user exist. It never deletes anything, and does nothing if an admin
// already exists, so it's safe to wire into the Docker CMD and run on every
// deploy/restart without wiping production data.
//
// Runs via `bun` (see app/Dockerfile's CMD), not plain `node`: the generated
// Prisma client (src/generated/prisma/client.ts) is TypeScript source, not
// compiled JS, and Bun transpiles it on the fly the same way it already runs
// prisma/seed.ts (package.json's "db:seed" script). Plain `node` can't
// import a .ts file without a loader.
//
// The account it ensures is the *root* admin (src/lib/root-admin.ts): the one
// the reset button leaves standing and the one no other admin can change the
// password of. Everything else in the system is built from it — supervisors,
// staff, the assistant's contact list — so it has to exist before anyone can
// sign in, on a database that has just been emptied as much as on a new one.
//
// Override the defaults via env vars in a deployment that wants a different
// owner. ROOT_ADMIN_EMAIL must match SEED_ADMIN_EMAIL if you change it, or
// the seeded account will not be the protected one:
//   SEED_ORG_NAME, SEED_ORG_SLUG, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";
import { STANDARD_EXPENSE_CATEGORIES } from "../src/lib/setup/standard-categories-data";

const prismaConfig = { log: ["error", "warn"] };
if (process.env.ACCELERATE_URL) {
  prismaConfig.accelerateUrl = process.env.ACCELERATE_URL;
} else {
  prismaConfig.adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
}
const prisma = new PrismaClient(prismaConfig);

const ORG_NAME = process.env.SEED_ORG_NAME || "WD Logistics";
const ORG_SLUG = process.env.SEED_ORG_SLUG || "wd-logistics";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Administrator";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@wd-logistics.co.zw";
// Deliberately trivial, and deliberately the client's choice: this is typed
// once, in the room, on the day the system goes live. Change it at the first
// sign-in — Settings → Account. Nothing else in the app accepts a password
// this weak; passwordProblem() would refuse it.
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "00000000";

async function main() {
  let organization = await prisma.organization.findFirst({ where: { slug: ORG_SLUG } });

  if (!organization) {
    organization = await prisma.organization.create({
      data: { name: ORG_NAME, slug: ORG_SLUG },
    });
    console.log(`✅ Created organization: ${organization.name}`);
  } else {
    console.log(`✅ Using existing organization: ${organization.name}`);
  }

  // Somewhere to put the first expense. Every expense form needs a category,
  // and a brand-new deployment has none — so the first thing the client meets
  // is a form they cannot complete.
  //
  // Only when there are none at all. Topping up whichever of the nine were
  // missing would add nine categories to a business that calls its own
  // Diesel, Rubber and Papers, on every single deploy.
  const categoryCount = await prisma.expenseCategory.count({
    where: { organizationId: organization.id },
  });
  if (categoryCount === 0) {
    await prisma.expenseCategory.createMany({
      data: STANDARD_EXPENSE_CATEGORIES.map((category) => ({
        ...category,
        organizationId: organization.id,
      })),
      skipDuplicates: true,
    });
    console.log(`✅ Added ${STANDARD_EXPENSE_CATEGORIES.length} standard expense categories`);
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { email: ADMIN_EMAIL },
    include: { members: true },
  });

  if (!existingAdmin) {
    const hashedPassword = await hashPassword(ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        emailVerified: true,
        accounts: {
          create: {
            accountId: ADMIN_EMAIL,
            providerId: "credential",
            password: hashedPassword,
          },
        },
        members: {
          create: { organizationId: organization.id, role: "admin" },
        },
      },
    });
    console.log(`✅ Created admin user: ${ADMIN_EMAIL}`);
    console.log(`   Password: ${ADMIN_PASSWORD} — change this after first login.`);
  } else {
    // The account exists. That is not the same as being able to get in, and
    // the two ways it can be true without being useful have both happened:
    //
    //  - a membership in the wrong organisation, or none at all, leaves an
    //    account that signs in and then has nothing to look at;
    //  - an account created some other way — invited, or made by a script —
    //    has no `credential` row, so the sign-in form refuses a password that
    //    was never set.
    //
    // This is the account the whole system is recovered from, so each of
    // those is repaired rather than reported.
    const membership = existingAdmin.members.find(
      (m) => m.organizationId === organization.id
    );

    if (!membership) {
      await prisma.member.create({
        data: { organizationId: organization.id, userId: existingAdmin.id, role: "admin" },
      });
      console.log(`✅ Linked existing user ${ADMIN_EMAIL} to ${organization.name} as admin`);
    } else if (membership.role !== "admin") {
      await prisma.member.update({
        where: { id: membership.id },
        data: { role: "admin" },
      });
      console.log(`✅ Restored admin on ${ADMIN_EMAIL} (was ${membership.role})`);
    }

    const credential = await prisma.account.findFirst({
      where: { userId: existingAdmin.id, providerId: "credential" },
    });

    if (!credential) {
      await prisma.account.create({
        data: {
          userId: existingAdmin.id,
          accountId: ADMIN_EMAIL,
          providerId: "credential",
          password: await hashPassword(ADMIN_PASSWORD),
        },
      });
      console.log(`✅ Set a sign-in password on ${ADMIN_EMAIL} — it had none.`);
      console.log(`   Password: ${ADMIN_PASSWORD} — change this after first login.`);
    } else if (!membership) {
      // Only the membership was missing; the password they already have is
      // still theirs, and overwriting it here would lock them out to fix a
      // different problem.
    } else {
      console.log(`✅ Admin user already exists: ${ADMIN_EMAIL} — nothing to do.`);
    }
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ ensure-admin failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
