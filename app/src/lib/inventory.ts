import type { Prisma } from "@/generated/prisma/client";

export type StockMovementType = "in" | "out" | "adjustment";

export const STOCK_MOVEMENT_LABELS: Record<StockMovementType, string> = {
  in: "Stock In",
  out: "Taken Out",
  adjustment: "Adjustment",
};

export class InsufficientStockError extends Error {
  constructor(itemName: string, available: number, requested: number, unit: string | null) {
    super(`Only ${available} ${unit || "units"} of ${itemName} in stock (requested ${requested})`);
    this.name = "InsufficientStockError";
  }
}

/** Where a part went. Exactly one of these, or none for "somewhere else". */
export interface StockDestination {
  truckId?: string | null;
  trailerId?: string | null;
  tripId?: string | null;
  driverId?: string | null;
}

/**
 * Turn stock leaving the storeroom into a cost on the thing that got it.
 *
 * Nothing in the inventory flow created an expense before this — a grep for
 * "expense" across the whole inventory folder matched nothing — so a $20 brake
 * pad fitted to a truck contributed $0 to that truck's costs, to its category
 * breakdown, to its maintenance spend and to every report. The parts left the
 * shelf and the money left the story.
 *
 * ## No account is debited, deliberately
 *
 * The cash went when the parts were *bought*. Debiting an account again when
 * they are *consumed* would count the same money twice — which is why this
 * writes the expense with `isPaid: true` and never calls
 * `debitAccountForExpense`. The client chose this on 12 Oct. Anyone
 * "fixing" it later should read this paragraph first.
 *
 * Quantity and unit are carried onto the expense, so the truck page can show a
 * supervisor "2 brake pads" without showing them a figure — the same fields
 * the fuel-litres work added in September.
 */
export async function postStockExpense(
  tx: Prisma.TransactionClient,
  params: {
    organizationId: string;
    categoryId: string;
    item: { id: string; name: string; unit: string | null };
    quantity: number;
    unitCost: number;
    date: Date;
    destination: StockDestination;
    reason?: string | null;
  },
) {
  const amount = Math.round(params.unitCost * params.quantity * 100) / 100;

  const expense = await tx.expense.create({
    data: {
      organizationId: params.organizationId,
      categoryId: params.categoryId,
      amount,
      quantity: params.quantity,
      unit: params.item.unit || "units",
      description: `${params.item.name} from stock`,
      notes: params.reason || null,
      date: params.date,
      // The money left when the stock was bought — see the note above.
      isPaid: true,
      paidDate: params.date,
      // One of these, matching the destination, so the existing cost engine
      // (lib/metrics/truck-costs.ts) finds it with the queries it already runs.
      ...(params.destination.truckId
        ? { truckExpenses: { create: { truckId: params.destination.truckId } } }
        : {}),
      ...(params.destination.trailerId
        ? { trailerExpenses: { create: { trailerId: params.destination.trailerId } } }
        : {}),
      ...(params.destination.tripId
        ? { tripExpenses: { create: { tripId: params.destination.tripId } } }
        : {}),
      ...(params.destination.driverId
        ? { driverExpenses: { create: { driverId: params.destination.driverId } } }
        : {}),
    },
  });

  return { expense, amount };
}
