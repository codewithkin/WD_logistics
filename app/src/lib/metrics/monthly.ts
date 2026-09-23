/**
 * Grouping rows into months for the list-page bar charts.
 *
 * The bug this replaces, which existed identically on the trips and expenses
 * screens: rows arrive ordered newest-first, were grouped into an object, and
 * then `Object.values(groups).slice(-6)` was plotted. Object key order follows
 * insertion, so that took the six *oldest* months and drew them right-to-left
 * in reverse — under a heading that read "Last 6 months".
 *
 * Group by a sortable `yyyy-MM` key, sort ascending, then take the last N.
 */

import { format } from "date-fns";

export interface MonthlyGroup<T> {
  /** "Sep 2026" — the year is always included, see @/lib/metrics/revenue. */
  month: string;
  /** Sort key, "2026-09". */
  key: string;
  value: T;
}

export function groupByMonth<TRow, TValue>(
  rows: TRow[],
  getDate: (row: TRow) => Date | string,
  empty: () => TValue,
  add: (accumulator: TValue, row: TRow) => TValue,
): MonthlyGroup<TValue>[] {
  const groups = new Map<string, MonthlyGroup<TValue>>();

  for (const row of rows) {
    const date = new Date(getDate(row));
    const key = format(date, "yyyy-MM");

    const existing =
      groups.get(key) ?? { key, month: format(date, "MMM yyyy"), value: empty() };
    existing.value = add(existing.value, row);
    groups.set(key, existing);
  }

  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key));
}

/** The most recent `count` months, oldest-to-newest so the chart reads left to right. */
export function lastMonths<T>(groups: MonthlyGroup<T>[], count: number): MonthlyGroup<T>[] {
  return groups.slice(-count);
}

/** "Sep 2026" -> "Sep '26", for cramped chart axes. Keeps the year. */
export function shortMonthLabel(month: string): string {
  return month.replace(" 20", " '");
}
