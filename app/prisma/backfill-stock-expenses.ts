/**
 * Charges stock that already left the storeroom to whatever got it.
 *
 * Nothing in the inventory flow created an expense before 12 Oct 2026, so
 * every part fitted since the system went live cost a truck $0: a $20 brake
 * pad was a `PartAllocation` row and a `StockMovement` row and nothing on the
 * truck's costs, its category breakdown or any report. The client asked for
 * the data already entered to be reconciled rather than left behind.
 *
 * Two passes, both idempotent:
 *
 *  1. **Allocations** — a `PartAllocation` already names its truck, so the
 *     cost goes straight onto it, dated `allocatedAt`.
 *  2. **Movements out** — a plain "take out" recorded only a sentence
 *     ("Truck ABC-1234", "Workshop"). Where that sentence names a truck or
 *     trailer on the fleet, the cost goes there, dated `createdAt`. Where it
 *     names nothing recognisable it is listed and skipped: an overhead the
 *     fleet should not carry is a judgement for the office, not for a script.
 *
 * Run:
 *   bun prisma/backfill-stock-expenses.ts            # dry run, prints the plan
 *   bun prisma/backfill-stock-expenses.ts --apply    # writes it
 *
 * ## What it refuses to guess
 *
 * - **An item with no expense category** is skipped and named. The category
 *   decides which line of the accounts the money lands on; picking one for the
 *   client would quietly file tyres under office costs. Set the defaults on
 *   the item form and run it again.
 * - **No unit cost, anywhere** — not on the movement, not on the allocation,
 *   not on the item — is skipped and named. A cost of zero is a lie that is
 *   hard to spot later.
 * - **A movement before 18 Sep 2026** (migration `20260918074703`, which added
 *   `StockMovement.unitCost`) has no price recorded at the time. The item's
 *   current price is used and the row is flagged `~` so a repricing since then
 *   is visible in the dry run.
 * - **No account is debited.** The cash left when the parts were bought; see
 *   the note on `postStockExpense` in `src/lib/inventory.ts`.
 */

import { prisma } from "../src/lib/prisma";
import { postStockExpense } from "../src/lib/inventory";

const APPLY = process.argv.includes("--apply");

/** Migration 20260918074703 added `StockMovement.unitCost`. */
const UNIT_COST_SINCE = new Date("2026-09-18T00:00:00Z");

interface Planned {
  kind: "allocation" | "movement";
  id: string;
  date: Date;
  item: { id: string; name: string; unit: string | null };
  quantity: number;
  unitCost: number;
  /** True when the price came from the item today rather than from the row. */
  pricedToday: boolean;
  categoryId: string;
  categoryName: string;
  target: string;
  truckId?: string | null;
  trailerId?: string | null;
  reason?: string | null;
}

interface Skipped {
  what: string;
  why: string;
}

const money = (amount: number) =>
  `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const shortDate = (date: Date) =>
  date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" });

async function main() {
  const organizations = await prisma.organization.findMany({ select: { id: true, name: true } });

  let totalRows = 0;
  let totalValue = 0;

  for (const organization of organizations) {
    const planned: Planned[] = [];
    const skipped: Skipped[] = [];

    // Trucks and trailers by registration, to read the free-text destinations
    // against. Lower-cased, since nobody typed them consistently.
    const [trucks, trailers] = await Promise.all([
      prisma.truck.findMany({
        where: { organizationId: organization.id },
        select: { id: true, registrationNo: true },
      }),
      prisma.trailer.findMany({
        where: { organizationId: organization.id },
        select: { id: true, registrationNo: true },
      }),
    ]);

    const findFleet = (text: string | null) => {
      if (!text) return null;
      const haystack = text.toLowerCase();
      const truck = trucks.find((t) => haystack.includes(t.registrationNo.toLowerCase()));
      if (truck) return { truckId: truck.id, label: `truck ${truck.registrationNo}` };
      const trailer = trailers.find((t) => haystack.includes(t.registrationNo.toLowerCase()));
      if (trailer) return { trailerId: trailer.id, label: `trailer ${trailer.registrationNo}` };
      return null;
    };

    // ------------------------------------------------------- 1. allocations
    const allocations = await prisma.partAllocation.findMany({
      where: {
        expenseId: null,
        inventoryItem: { organizationId: organization.id },
      },
      select: {
        id: true,
        quantity: true,
        unitCost: true,
        allocatedAt: true,
        reason: true,
        truck: { select: { id: true, registrationNo: true } },
        inventoryItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            unitCost: true,
            defaultExpenseCategoryId: true,
            defaultExpenseCategory: { select: { name: true } },
          },
        },
      },
      orderBy: { allocatedAt: "asc" },
    });

    for (const allocation of allocations) {
      const item = allocation.inventoryItem;
      const label = `${shortDate(allocation.allocatedAt)} ${item.name} → ${allocation.truck.registrationNo}`;

      if (!item.defaultExpenseCategoryId) {
        skipped.push({ what: label, why: `no expense category set on "${item.name}"` });
        continue;
      }
      // The cost stamped on the allocation when it happened, else the paired
      // movement's, else what the item costs today.
      const paired = await prisma.stockMovement.findFirst({
        where: {
          inventoryItemId: item.id,
          type: "out",
          quantity: allocation.quantity,
          unitCost: { not: null },
          createdAt: {
            gte: new Date(allocation.allocatedAt.getTime() - 60 * 60 * 1000),
            lte: new Date(allocation.allocatedAt.getTime() + 60 * 60 * 1000),
          },
        },
        select: { unitCost: true },
      });
      const unitCost = allocation.unitCost ?? paired?.unitCost ?? item.unitCost ?? 0;
      if (unitCost <= 0) {
        skipped.push({ what: label, why: `no unit cost recorded for "${item.name}"` });
        continue;
      }

      planned.push({
        kind: "allocation",
        id: allocation.id,
        date: allocation.allocatedAt,
        item: { id: item.id, name: item.name, unit: item.unit },
        quantity: allocation.quantity,
        unitCost,
        pricedToday: allocation.unitCost == null && paired?.unitCost == null,
        categoryId: item.defaultExpenseCategoryId,
        categoryName: item.defaultExpenseCategory?.name ?? "—",
        target: `truck ${allocation.truck.registrationNo}`,
        truckId: allocation.truck.id,
        reason: allocation.reason,
      });
    }

    // --------------------------------------------------- 2. movements out
    const movements = await prisma.stockMovement.findMany({
      where: {
        organizationId: organization.id,
        type: "out",
        expenseId: null,
        // Anything the new dialog recorded already posted its own cost; these
        // are the ones that only ever had a sentence.
        truckId: null,
        trailerId: null,
        tripId: null,
        driverId: null,
      },
      select: {
        id: true,
        quantity: true,
        unitCost: true,
        destination: true,
        reason: true,
        createdAt: true,
        inventoryItem: {
          select: {
            id: true,
            name: true,
            unit: true,
            unitCost: true,
            defaultExpenseCategoryId: true,
            defaultExpenseCategory: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    for (const movement of movements) {
      const item = movement.inventoryItem;
      const label = `${shortDate(movement.createdAt)} ${item.name} → ${movement.destination || "nowhere named"}`;

      const fleet = findFleet(movement.destination);
      if (!fleet) {
        skipped.push({
          what: label,
          why: movement.destination
            ? `"${movement.destination}" is not a truck or trailer on the fleet`
            : "no destination was recorded",
        });
        continue;
      }
      if (!item.defaultExpenseCategoryId) {
        skipped.push({ what: label, why: `no expense category set on "${item.name}"` });
        continue;
      }
      const unitCost = movement.unitCost ?? item.unitCost ?? 0;
      if (unitCost <= 0) {
        skipped.push({ what: label, why: `no unit cost recorded for "${item.name}"` });
        continue;
      }

      planned.push({
        kind: "movement",
        id: movement.id,
        date: movement.createdAt,
        item: { id: item.id, name: item.name, unit: item.unit },
        quantity: movement.quantity,
        unitCost,
        pricedToday: movement.unitCost == null && movement.createdAt < UNIT_COST_SINCE,
        categoryId: item.defaultExpenseCategoryId,
        categoryName: item.defaultExpenseCategory?.name ?? "—",
        target: fleet.label,
        truckId: fleet.truckId ?? null,
        trailerId: fleet.trailerId ?? null,
        reason: movement.reason,
      });
    }

    // ------------------------------------------------------------- report
    if (planned.length === 0 && skipped.length === 0) {
      console.log(`\n${organization.name}: nothing left to charge — every movement carries its cost.`);
      continue;
    }

    console.log(`\n${organization.name}: ${planned.length} cost(s) to post`);
    if (planned.length > 0) {
      console.log(
        `${"date".padEnd(11)}${"item".padEnd(26)}${"to".padEnd(22)}${"qty".padStart(6)}` +
          `${"each".padStart(11)}${"cost".padStart(12)}  category`,
      );
      for (const row of planned) {
        const amount = Math.round(row.unitCost * row.quantity * 100) / 100;
        console.log(
          `${shortDate(row.date).padEnd(11)}${row.item.name.slice(0, 25).padEnd(26)}` +
            `${row.target.slice(0, 21).padEnd(22)}${String(row.quantity).padStart(6)}` +
            `${money(row.unitCost).padStart(11)}${money(amount).padStart(12)}  ${row.categoryName}` +
            (row.pricedToday ? "  ~ priced at today's cost" : ""),
        );
      }
      const value = planned.reduce((sum, row) => sum + row.unitCost * row.quantity, 0);
      const estimated = planned.filter((row) => row.pricedToday).length;
      console.log(
        `  ${money(value)} of stock to charge to the fleet` +
          (estimated ? `, ${estimated} row(s) priced at today's cost (~) — check those` : ""),
      );
      totalRows += planned.length;
      totalValue += value;
    }

    if (skipped.length > 0) {
      console.log(`\n  ${skipped.length} row(s) skipped — these need a decision:`);
      // Grouped, because fifty rows of the same missing category is one job.
      const byReason = new Map<string, string[]>();
      for (const row of skipped) {
        byReason.set(row.why, [...(byReason.get(row.why) ?? []), row.what]);
      }
      for (const [why, rows] of byReason) {
        console.log(`    ${why} (${rows.length})`);
        for (const row of rows.slice(0, 5)) console.log(`      ${row}`);
        if (rows.length > 5) console.log(`      … and ${rows.length - 5} more`);
      }
    }

    // -------------------------------------------------------------- write
    if (APPLY && planned.length > 0) {
      for (const row of planned) {
        await prisma.$transaction(async (tx) => {
          const { expense } = await postStockExpense(tx, {
            organizationId: organization.id,
            categoryId: row.categoryId,
            item: row.item,
            quantity: row.quantity,
            unitCost: row.unitCost,
            date: row.date,
            destination: { truckId: row.truckId, trailerId: row.trailerId },
            reason: row.reason,
          });

          // The link is what makes this idempotent: a row with an expense is
          // no longer picked up by either query above.
          if (row.kind === "allocation") {
            await tx.partAllocation.update({
              where: { id: row.id },
              data: { expenseId: expense.id, unitCost: row.unitCost },
            });
          } else {
            await tx.stockMovement.update({
              where: { id: row.id },
              data: {
                expenseId: expense.id,
                truckId: row.truckId ?? undefined,
                trailerId: row.trailerId ?? undefined,
                unitCost: row.unitCost,
              },
            });
          }
        });
      }
      console.log(`  ✅ posted ${planned.length} cost(s)`);
    }
  }

  console.log(
    `\n${totalRows} cost(s), ${money(totalValue)} ${APPLY ? "charged to the fleet" : "to charge"}.`,
  );
  if (!APPLY && totalRows > 0) {
    console.log("Dry run — nothing was written. Re-run with --apply once the rows above look right.");
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error("❌ backfill-stock-expenses failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
