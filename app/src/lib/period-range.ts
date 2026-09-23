import "server-only";

import { getDateRangeFromParams, type DateRangeValue } from "@/lib/period-utils";

/**
 * The server-side half of the universal period filter, for server *actions*.
 *
 * Server pages already call `getDateRangeFromParams` on their searchParams.
 * Actions get the range from the client instead (see `usePeriodRange`), and
 * they must not trust it blindly: an unparseable or inverted range used to
 * silently produce an empty report rather than an error.
 */

/** What a client sends when it wants an action to honour the page's period. */
export interface PeriodInput {
  from?: string | Date | null;
  to?: string | Date | null;
  /** Preset such as "3m"; used when from/to are absent. */
  period?: string | null;
  label?: string | null;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Resolves whatever the client sent into a usable range, falling back to the
 * caller's default. Swapped bounds are corrected rather than rejected — the
 * user's intent is unambiguous and an empty export is not a useful answer.
 */
export function resolvePeriod(
  input: PeriodInput | undefined,
  defaultPeriod = "1m",
): DateRangeValue {
  const from = toDate(input?.from);
  const to = toDate(input?.to);

  if (from && to) {
    const [start, end] = from <= to ? [from, to] : [to, from];
    return {
      from: start,
      to: end,
      label: input?.label?.trim() || formatRangeLabel(start, end),
    };
  }

  return getDateRangeFromParams(
    { period: input?.period ?? undefined },
    defaultPeriod,
  );
}

/**
 * The window of the same length immediately before `range`, for
 * period-on-period comparisons. A 3-month view compares against the 3 months
 * before it, rather than against a fixed "last calendar month".
 */
export function previousPeriod(range: DateRangeValue): DateRangeValue {
  const span = range.to.getTime() - range.from.getTime();
  const to = new Date(range.from.getTime() - 1);
  const from = new Date(to.getTime() - span);
  return { from, to, label: `Previous ${formatRangeLabel(from, to)}` };
}

/** "1 Jul 2026 – 30 Sep 2026", the form every PDF header prints. */
export function formatRangeLabel(from: Date, to: Date): string {
  const fmt = (d: Date) =>
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(from)} – ${fmt(to)}`;
}

/**
 * The line every generated document carries, so a reader can tell at a glance
 * what window the figures cover.
 */
export function periodLine(range: DateRangeValue): string {
  if (range.label === "All Time") return "Period: All time";
  return `Period: ${formatRangeLabel(range.from, range.to)}`;
}
