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
// Override the defaults via env vars if you don't want the stock
// dziruniw@gmail.com / @logisticswd credentials in a production deploy:
//   SEED_ORG_NAME, SEED_ORG_SLUG, SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "better-auth/crypto";

const prismaConfig = { log: ["error", "warn"] };
if (process.env.ACCELERATE_URL) {
  prismaConfig.accelerateUrl = process.env.ACCELERATE_URL;
} else {
  prismaConfig.adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
}
const prisma = new PrismaClient(prismaConfig);

const ORG_NAME = process.env.SEED_ORG_NAME || "WD Logistics";
const ORG_SLUG = process.env.SEED_ORG_SLUG || "wd-logistics";
const ADMIN_NAME = process.env.SEED_ADMIN_NAME || "Mr Dziruni";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "dziruniw@gmail.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "@logisticswd";

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
  } else if (!existingAdmin.members.some((m) => m.organizationId === organization.id)) {
    await prisma.member.create({
      data: { organizationId: organization.id, userId: existingAdmin.id, role: "admin" },
    });
    console.log(`✅ Linked existing user ${ADMIN_EMAIL} to ${organization.name} as admin`);
  } else {
    console.log(`✅ Admin user already exists: ${ADMIN_EMAIL} — nothing to do.`);
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
