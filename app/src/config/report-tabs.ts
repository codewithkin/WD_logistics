import { reportConfigs } from "@/config/reports";

/**
 * Which reports belong to which tab on the Reports page.
 *
 * The "Generate" button used to sit outside the tabs and always produced the
 * Revenue report no matter what you were looking at — so from the Fleet tab,
 * the button silently handed you something unrelated to anything on screen.
 * This is the mapping that makes it follow the tab instead.
 *
 * Order matters: the first entry is the tab's primary report, the one the
 * button generates when you don't pick something more specific.
 */
export const TAB_REPORT_TYPES: Record<string, string[]> = {
  overview: ["revenue", "expenses", "trip-summary"],
  financial: [
    "profit-loss",
    "cash-flow",
    "aged-receivables",
    "creditors",
    "account-ledger",
    "revenue",
    "expenses",
    "customer-statement",
  ],
  fleet: ["truck-cost-breakdown", "profit-per-unit", "truck-profitability", "trip-summary"],
};

export const TAB_LABELS: Record<string, string> = {
  overview: "Overview",
  financial: "Financial",
  fleet: "Fleet",
  generate: "Generate",
};

/** The report types shown for a tab, skipping any that no longer exist. */
export function reportTypesForTab(tab: string): string[] {
  return (TAB_REPORT_TYPES[tab] ?? []).filter((type) => type in reportConfigs);
}

/** The report the plain "Generate" action produces on this tab. */
export function primaryReportTypeForTab(tab: string): string | null {
  return reportTypesForTab(tab)[0] ?? null;
}

/**
 * Reports scoped to one truck or one customer can't be produced in a single
 * click — they need that record picked first, over in the Generate tab.
 */
export function needsSelection(reportType: string): boolean {
  const config = reportConfigs[reportType];
  return Boolean(
    config?.requiresCustomer ||
      config?.requiresTruck ||
      config?.requiresTrailer ||
      config?.requiresTrip,
  );
}
