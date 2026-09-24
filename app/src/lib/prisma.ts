import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const log =
  process.env.NODE_ENV === "development"
    ? (["query", "error", "warn"] as const)
    : (["error"] as const);

/**
 * Prisma 7's "prisma-client" engine (see the generator block in
 * schema.prisma) ships no query engine binary. It needs either Accelerate
 * (`accelerateUrl`, for prisma+postgres:// URLs) or an explicit driver
 * adapter for a plain postgresql:// connection string. Omitting both throws
 * PrismaClientConstructorValidationError at startup.
 *
 * The two are separate constructor calls rather than one call with a spread
 * ternary: spreading produces a union of option shapes, and Prisma's
 * constructor is generic over the exact object it is given, so a union is not
 * assignable to it. Same behaviour, and it typechecks.
 */
function createPrismaClient(): PrismaClient {
  if (process.env.ACCELERATE_URL) {
    return new PrismaClient({
      accelerateUrl: process.env.ACCELERATE_URL,
      log: [...log],
    });
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
    log: [...log],
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
