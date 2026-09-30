/**
 * How much of a thing an expense bought.
 *
 * Added 2026-09-30 for two reasons, both from the client. A supervisor may
 * no longer see what a truck costs, but still has to run it — so the truck's
 * page shows them 1,840 litres of diesel and four tyres fitted instead of a
 * figure in dollars. And fuel economy stops being guessed from spending: km
 * per litre is now litres actually bought against kilometres actually run.
 *
 * Plain strings with the valid values listed, as everywhere else in this
 * schema (see CLAUDE.md) — validated here and in the form, not by the
 * database.
 */

export const EXPENSE_UNITS = [
  { value: "litres", label: "Litres", short: "L" },
  { value: "units", label: "Units", short: "" },
  { value: "hours", label: "Hours", short: "h" },
  { value: "kg", label: "Kilograms", short: "kg" },
  { value: "km", label: "Kilometres", short: "km" },
] as const;

export type ExpenseUnit = (typeof EXPENSE_UNITS)[number]["value"];

export const EXPENSE_UNIT_VALUES = EXPENSE_UNITS.map((u) => u.value) as [
  ExpenseUnit,
  ...ExpenseUnit[],
];

export function isExpenseUnit(value: unknown): value is ExpenseUnit {
  return typeof value === "string" && EXPENSE_UNITS.some((u) => u.value === value);
}

/**
 * "1,840 L", "4 tyres", "—".
 *
 * Returns null when nothing was recorded, so a caller can say "not recorded"
 * rather than print a zero. Every expense entered before 30 Sep 2026 is in
 * that state and always will be; a zero there would drag a fleet's fuel
 * economy into nonsense.
 */
export function formatQuantity(
  quantity: number | null | undefined,
  unit: string | null | undefined,
): string | null {
  if (quantity === null || quantity === undefined) return null;
  const rounded = Math.round(quantity * 100) / 100;
  const amount = rounded.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const known = EXPENSE_UNITS.find((u) => u.value === unit);
  if (!known) return amount;
  return known.short ? `${amount} ${known.short}` : `${amount} ${known.label.toLowerCase()}`;
}
