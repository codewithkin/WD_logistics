import "dotenv/config";
import { PrismaClient } from "@/generated/prisma/client";
import { hashPassword } from "better-auth/crypto";

const prisma = new PrismaClient({
  // For Prisma 7.x - use adapter for local, accelerateUrl for cloud
  ...(process.env.ACCELERATE_URL
    ? { accelerateUrl: process.env.ACCELERATE_URL }
    : {}),
  log: ["query", "error", "warn"],
});

async function main() {
  console.log("🌱 Starting seed...");

  // Check if admin user already exists
  const existingAdmin = await prisma.user.findFirst({
    where: {
      email: "admin@wdlogistics.com",
    },
    include: {
      members: true,
    },
  });

  if (existingAdmin && existingAdmin.members.length > 0) {
    console.log("✅ Admin user already exists:", existingAdmin.email);
    console.log("✅ Admin is already a member of an organization");
    return;
  }

  // Check if organization exists
  let organization = await prisma.organization.findFirst({
    where: {
      slug: "wd-logistics",
    },
  });

  // Create organization if it doesn't exist
  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: "WD Logistics",
        slug: "wd-logistics",
        logo: null,
        metadata: JSON.stringify({
          address: "123 Logistics Ave",
          phone: "+1234567890",
          currency: "USD",
        }),
      },
    });
    console.log("✅ Organization created:", organization.name);
  } else {
    console.log("✅ Organization already exists:", organization.name);
  }

  // If admin user exists but is not a member, add them
  if (existingAdmin && existingAdmin.members.length === 0) {
    await prisma.member.create({
      data: {
        organizationId: organization.id,
        userId: existingAdmin.id,
        role: "admin",
      },
    });
    console.log("✅ Added existing admin user to organization");
  } else if (!existingAdmin) {
    // Create admin user
    const hashedPassword = await hashPassword("Admin@123");

    const adminUser = await prisma.user.create({
      data: {
        name: "System Admin",
        email: "admin@wdlogistics.com",
        emailVerified: true,
        accounts: {
          create: {
            accountId: "admin@wdlogistics.com",
            providerId: "credential",
            password: hashedPassword,
          },
        },
        members: {
          create: {
            organizationId: organization.id,
            role: "admin",
          },
        },
      },
    });

    console.log("✅ Admin user created:", adminUser.email);
  }

  // Create default expense categories if they don't exist
  const existingCategories = await prisma.expenseCategory.count({
    where: {
      organizationId: organization.id,
    },
  });

  if (existingCategories === 0) {
    const expenseCategories = await prisma.expenseCategory.createMany({
      data: [
        { organizationId: organization.id, name: "Fuel", isTrip: true, isTruck: true, color: "#ef4444" },
        { organizationId: organization.id, name: "Maintenance", isTruck: true, color: "#f97316" },
        { organizationId: organization.id, name: "Tires", isTruck: true, color: "#84cc16" },
        { organizationId: organization.id, name: "Tolls", isTrip: true, color: "#06b6d4" },
        { organizationId: organization.id, name: "Parking", isTrip: true, color: "#8b5cf6" },
        { organizationId: organization.id, name: "Driver Allowance", isTrip: true, color: "#ec4899" },
        { organizationId: organization.id, name: "Insurance", isTruck: true, color: "#6366f1" },
        { organizationId: organization.id, name: "Registration", isTruck: true, color: "#14b8a6" },
        { organizationId: organization.id, name: "Other", isTrip: true, isTruck: true, color: "#71717a" },
      ],
    });

    console.log(`✅ Created ${expenseCategories.count} expense categories`);
  } else {
    console.log(`✅ Expense categories already exist (${existingCategories})`);
  }

  console.log("\n🎉 Seed completed successfully!");
  console.log("\n📝 Admin credentials:");
  console.log("   Email: admin@wdlogistics.com");
  console.log("   Password: Admin@123");
  console.log("\n⚠️  Please change the password after first login!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
