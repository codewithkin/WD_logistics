"use client";

/**
 * Month-by-month spend in one category.
 *
 * Bars, not a line: these are discrete totals per month, and a line implies a
 * value between them. Labels carry the year, because a 1y or all-time view
 * otherwise reads as a repeating list of the same twelve month names — the
 * exact problem the graph audit found across the app.
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { shortMonthLabel } from "@/lib/metrics/monthly";
import { formatCurrency } from "@/lib/utils";

interface Props {
  data: Array<{ month: string; amount: number; count: number }>;
}

export function CategoryMonthlyChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No spend in this period, so there is nothing to chart.
      </p>
    );
  }

  const chartData = data.map((row) => ({
    ...row,
    label: shortMonthLabel(row.month),
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            fontSize={12}
            interval="preserveStartEnd"
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            fontSize={12}
            width={70}
            tickFormatter={(value: number) =>
              value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`
            }
            label={{
              value: "Amount ($)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, textAnchor: "middle" },
            }}
          />
          <Tooltip
            cursor={{ className: "fill-muted/40" }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
            }}
            // Formatted by series, not by magnitude: "Spent" is money and
            // "Expenses" is a count, and guessing from the number is how the
            // old charts ended up putting a "$" in front of a trip count.
            formatter={(value: unknown, name: unknown) =>
              [
                name === "amount"
                  ? formatCurrency(Number(value))
                  : String(value),
                name === "amount" ? "Spent" : "Expenses",
              ] as [string, string]
            }
            labelFormatter={(label: string) => label}
          />
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} className="fill-primary" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
