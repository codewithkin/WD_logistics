/**
 * What kind of cost an expense category represents, independent of its name.
 *
 * The truck cost breakdown has to answer "is this truck losing money because
 * of fuel economy, or because it is sitting in the workshop?" — and it cannot
 * do that by matching on category names, because one fleet's "Diesel" is
 * another's "Fuel & lubricants" and a third's "Running costs". The admin tags
 * each category once; every report reads the tag.
 *
 * Client-safe: the category form imports this for its dropdown.
 */

export const COST_KINDS = [
  "fuel",
  "maintenance",
  "tyres",
  "tolls",
  "permits",
  "salaries",
  "insurance",
  "other",
] as const;

export type CostKind = (typeof COST_KINDS)[number];

export const COST_KIND_LABELS: Record<CostKind, string> = {
  fuel: "Fuel & lubricants",
  maintenance: "Maintenance & repairs",
  tyres: "Tyres",
  tolls: "Tolls & border fees",
  permits: "Permits & licensing",
  salaries: "Salaries & allowances",
  insurance: "Insurance",
  other: "Other",
};

/** What each kind is for, shown as help text on the category form. */
export const COST_KIND_HINTS: Record<CostKind, string> = {
  fuel: "Counted in the fuel-per-km figure on a truck's cost breakdown.",
  maintenance: "Counted as workshop spend alongside downtime days.",
  tyres: "Tracked separately from maintenance — they wear by distance.",
  tolls: "Road and border charges incurred on a trip.",
  permits: "Cross-border permits, licences and customs clearing.",
  salaries: "Driver pay, allowances and subsistence.",
  insurance: "Vehicle and goods-in-transit cover.",
  other: "Anything that doesn't belong in the buckets above.",
};

export function isCostKind(value: string | null | undefined): value is CostKind {
  return Boolean(value) && (COST_KINDS as readonly string[]).includes(value!);
}

export function costKindLabel(value: string | null | undefined): string {
  return isCostKind(value) ? COST_KIND_LABELS[value] : "Untagged";
}
