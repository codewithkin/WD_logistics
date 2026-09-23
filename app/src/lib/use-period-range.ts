"use client";

/**
 * The client-side half of the universal period filter.
 *
 * Server pages read the period out of their searchParams with
 * `getDateRangeFromParams`. Client components — export buttons, mostly —
 * couldn't, so most of them passed their own hardcoded range to the server
 * action instead. That is why "Export PDF" on a page showing three months of
 * rows produced a file covering the previous month.
 *
 * This hook reads the same `period` / `from` / `to` params off the URL and
 * resolves them through the same parser, so a button can hand the action the
 * range the user is actually looking at.
 */

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  getDateRangeFromParams,
  type DateRangeValue,
} from "@/lib/period-utils";

/** The range as a server action wants it: ISO strings plus a printable label. */
export interface PeriodRangePayload {
  from: string;
  to: string;
  label: string;
}

export interface UsePeriodRangeResult extends DateRangeValue {
  /** Serialisable form, safe to pass straight into a server action. */
  payload: PeriodRangePayload;
}

export function usePeriodRange(defaultPeriod = "1m"): UsePeriodRangeResult {
  const searchParams = useSearchParams();
  const period = searchParams.get("period") ?? undefined;
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  return useMemo(() => {
    const range = getDateRangeFromParams({ period, from, to }, defaultPeriod);
    return {
      ...range,
      payload: {
        from: range.from.toISOString(),
        to: range.to.toISOString(),
        label: range.label,
      },
    };
  }, [period, from, to, defaultPeriod]);
}
