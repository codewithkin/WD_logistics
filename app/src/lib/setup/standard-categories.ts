import "server-only";

import { prisma } from "@/lib/prisma";
import { ensureAccountsExist } from "@/lib/accounts-server";
import { STANDARD_EXPENSE_CATEGORIES } from "@/lib/setup/standard-categories-data";

/**
 * Giving an organisation the setup it needs before anyone can record anything.
 *
 * The list itself lives in `standard-categories-data.ts`, without the
 * server-only marker, because prisma/ensure-admin.mjs reads the same list on a
 * fresh deployment and cannot import anything that pulls in Next.
 */

/**
 * Create the standard categories, each pointing at the account that kind of
 * spending normally comes out of. Returns how many it created.
 */
export async function ensureStandardExpenseCategories(
  organizationId: string,
): Promise<number> {
  const existing = await prisma.expenseCategory.count({ where: { organizationId } });
  if (existing > 0) return 0;

  // The accounts have to be there before a category can point at one.
  await ensureAccountsExist(organizationId);
  const accounts = await prisma.financialAccount.findMany({
    where: { organizationId },
    select: { id: true, type: true },
  });
  const accountIdByType = new Map(accounts.map((a) => [a.type, a.id]));

  const result = await prisma.expenseCategory.createMany({
    data: STANDARD_EXPENSE_CATEGORIES.map(({ account, ...category }) => ({
      ...category,
      organizationId,
      // Null rather than a throw if an account somehow isn't there: a category
      // with no account still records expenses, it just doesn't move money.
      defaultAccountId: accountIdByType.get(account) ?? null,
    })),
    skipDuplicates: true,
  });
  return result.count;
}
