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
