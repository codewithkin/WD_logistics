import "server-only";

import { prisma } from "@/lib/prisma";
import { STANDARD_EXPENSE_CATEGORIES } from "@/lib/setup/standard-categories-data";

/**
 * Creating the standard categories, for the app.
 *
 * The list itself lives in `standard-categories-data.ts`, without the
 * server-only marker, because prisma/ensure-admin.mjs reads the same list on
 * a fresh deployment and cannot import anything that pulls in Next.
 */

/**
 * Create any of the standard categories this organisation does not have.
 *
 * Idempotent and additive — it matches on name and never touches one that
 * exists, so an admin who renamed "Fuel" to "Diesel" gets a second category
 * called Fuel rather than having their own quietly rewritten. That is the
 * lesser of the two surprises: an extra row is visible and deletable, and a
 * rewritten one is neither.
 *
 * Returns how many it created, which the reset reports.
 */
export async function ensureStandardExpenseCategories(
  organizationId: string,
): Promise<number> {
  const existing = await prisma.expenseCategory.findMany({
    where: { organizationId },
    select: { name: true },
  });
  const have = new Set(existing.map((row) => row.name.trim().toLowerCase()));

  const missing = STANDARD_EXPENSE_CATEGORIES.filter(
    (category) => !have.has(category.name.toLowerCase()),
  );
  if (missing.length === 0) return 0;

  const result = await prisma.expenseCategory.createMany({
    data: missing.map((category) => ({ ...category, organizationId })),
    skipDuplicates: true,
  });
  return result.count;
}
