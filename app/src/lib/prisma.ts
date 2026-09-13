import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // Prisma 7's "prisma-client" engine (see generator block in schema.prisma)
    // has no built-in query engine binary — it requires either Accelerate
    // (accelerateUrl, for prisma+postgres:// / Prisma Postgres URLs) or an
    // explicit driver adapter for a plain postgresql:// connection string.
    // Omitting both throws PrismaClientConstructorValidationError.
    ...(process.env.ACCELERATE_URL
      ? { accelerateUrl: process.env.ACCELERATE_URL }
      : { adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) }),
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
