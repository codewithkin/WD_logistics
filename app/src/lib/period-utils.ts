import { startOfDay, endOfDay, subDays, subWeeks, subMonths, subYears } from "date-fns";

export interface DateRangeValue {
  from: Date;
  to: Date;
  label: string;
}

/**
 * Server-side utility to parse period strings from URL params
 * 
 * Period Format:
 * - <number><unit> where unit is:
 *   - d: days (e.g., "1d" = last 24 hours, "7d" = last 7 days)
 *   - w: weeks (e.g., "1w" = last week, "2w" = last 2 weeks)
 *   - m: months (e.g., "1m" = last month, "6m" = last 6 months)
 *   - y: years (e.g., "1y" = last year, "2y" = last 2 years)
 * - Special values:
 *   - "ytd": Year to date (from Jan 1st of current year)
 *   - "all": All time (from year 2000)
 * 
 * Examples:
 * - "1d" → Last 24 hours
 * - "7d" → Last 7 days
 * - "1w" → Last week
 * - "1m" → Last month
 * - "3m" → Last 3 months
 * - "6m" → Last 6 months
 * - "1y" → Last year
 * - "2y" → Last 2 years
 * - "ytd" → Year to date
 * - "all" → All time
 */
export function parsePeriod(periodStr: string | null | undefined): DateRangeValue | null {
  if (!periodStr) return null;

  const now = new Date();
  const to = endOfDay(now);

  // Handle special cases
  if (periodStr === "ytd") {
    return {
      from: startOfDay(new Date(now.getFullYear(), 0, 1)),
      to,
      label: "Year to Date",
    };
  }

  if (periodStr === "all") {
    return {
      from: new Date(2000, 0, 1),
      to,
      label: "All Time",
    };
  }

  // Parse numeric format: <number><unit>
  const match = periodStr.match(/^(\d+)(d|w|m|y)$/);
  if (!match) return null;

  const [, numStr, unit] = match;
  const num = parseInt(numStr, 10);

  let from: Date;
  let label: string;

  switch (unit) {
    case "d":
      from = startOfDay(subDays(now, num));
      label = num === 1 ? "Last 24 Hours" : `Last ${num} Days`;
      break;
    case "w":
      from = startOfDay(subWeeks(now, num));
      label = num === 1 ? "Last Week" : `Last ${num} Weeks`;
      break;
    case "m":
      from = startOfDay(subMonths(now, num));
      label = num === 1 ? "Last Month" : `Last ${num} Months`;
      break;
    case "y":
      from = startOfDay(subYears(now, num));
      label = num === 1 ? "Last Year" : `Last ${num} Years`;
      break;
    default:
      return null;
  }

  return { from, to, label };
}

/**
 * Gets the date range from search params (server-side)
 * Supports both "period" param and explicit "from"/"to" params
 */
export function getDateRangeFromParams(
  searchParams: { period?: string; from?: string; to?: string },
  defaultPeriod: string = "1m"
): DateRangeValue {
  const { period, from, to } = searchParams;

  // Try period param first
  if (period) {
    const parsed = parsePeriod(period);
    if (parsed) return parsed;
  }

  // Try explicit from/to params
  if (from && to) {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      return {
        from: startOfDay(fromDate),
        to: endOfDay(toDate),
        label: "Custom Range",
      };
    }
  }

  // Fall back to default period
  const defaultRange = parsePeriod(defaultPeriod);
  if (defaultRange) return defaultRange;

  // Ultimate fallback: last month
  const now = new Date();
  return {
    from: startOfDay(subMonths(now, 1)),
    to: endOfDay(now),
    label: "Last Month",
  };
}

/**
 * Predefined period options for reference
 */
export const PERIOD_PRESETS = [
  { value: "1d", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "1w", label: "Last Week" },
  { value: "1m", label: "Last Month" },
  { value: "3m", label: "Last 3 Months" },
  { value: "6m", label: "Last 6 Months" },
  { value: "1y", label: "Last Year" },
  { value: "ytd", label: "Year to Date" },
  { value: "all", label: "All Time" },
] as const;
