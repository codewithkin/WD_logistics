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
 * Only on an organisation that has none — see below.
 *
 * Returns how many it created, which the reset reports.
 */
export async function ensureStandardExpenseCategories(
  organizationId: string,
): Promise<number> {
  // Only when there are none at all.
  //
  // Filling in whichever of the nine were "missing" sounds more helpful and
  // is worse: a business that calls its categories Diesel, Rubber and Papers
  // would get nine more on the next deploy, every deploy, until somebody
  // deleted them one at a time. An empty chart of accounts is the only state
  // where this is unambiguously a help rather than an opinion.
  const existing = await prisma.expenseCategory.count({ where: { organizationId } });
  if (existing > 0) return 0;

  const result = await prisma.expenseCategory.createMany({
    data: STANDARD_EXPENSE_CATEGORIES.map((category) => ({ ...category, organizationId })),
    skipDuplicates: true,
  });
  return result.count;
}
