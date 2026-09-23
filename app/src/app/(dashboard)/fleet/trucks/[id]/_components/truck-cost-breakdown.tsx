"use client";

/**
 * "Is this truck running us a loss, and if so where?" — on the page.
 *
 * The order is the order the question gets asked in: the P&L first, then the
 * two usual culprits (fuel economy, time in the workshop) called out against
 * the fleet average, then the full category split, then the individual
 * expenses behind whichever category the reader clicks.
 *
 * Every figure here is admin-only; the server page decides that.
 */

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Fuel,
  Route,
  TrendingDown,
  TrendingUp,
  Wrench,
} from "lucide-react";
import type {
  CategoryCost,
  TruckCostBreakdown,
} from "@/lib/metrics/truck-costs";

export function TruckCostBreakdownPanel({
  data,
  periodLabel,
  truckId,
}: {
  data: TruckCostBreakdown;
  periodLabel: string;
  truckId: string;
}) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const loss = data.profit < 0;
  const worst = data.byCategory.filter((c) => c.aboveFleetAverage);

  return (
    <div className="mt-6 space-y-6">
      {/* ---- The P&L question ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            {loss ? (
              <TrendingDown className="h-5 w-5 text-destructive" />
            ) : (
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            )}
            Profit and loss ({periodLabel})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure label="Revenue earned" value={formatCurrency(data.revenue)} />
            <Figure label="Costs" value={formatCurrency(data.expenses)} />
            <Figure
              label={loss ? "Loss" : "Profit"}
              value={formatCurrency(Math.abs(data.profit))}
              tone={loss ? "bad" : "good"}
            />
            <Figure
              label="Margin"
              value={data.margin === null ? "—" : `${data.margin}%`}
              tone={loss ? "bad" : undefined}
              hint={`Fleet average profit ${formatCurrency(data.fleet.averageProfit)}`}
            />
          </div>

          <Separator />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Figure
              label="Trips"
              value={String(data.trips)}
              hint={`${data.kilometres.toLocaleString()} km`}
            />
            <Figure
              label="Revenue per km"
              value={data.revenuePerKm === null ? "—" : formatCurrency(data.revenuePerKm)}
            />
            <Figure
              label="Cost per km"
              value={data.costPerKm === null ? "—" : formatCurrency(data.costPerKm)}
              hint={
                data.fleet.averageCostPerKm === null
                  ? undefined
                  : `Fleet ${formatCurrency(data.fleet.averageCostPerKm)}`
              }
              tone={
                data.costPerKm !== null &&
                data.fleet.averageCostPerKm !== null &&
                data.costPerKm > data.fleet.averageCostPerKm * 1.2
                  ? "bad"
                  : undefined
              }
            />
            <Figure
              label="Fuel per km"
              value={data.fuelPerKm === null ? "—" : formatCurrency(data.fuelPerKm)}
              hint={
                data.fleet.averageFuelPerKm === null
                  ? undefined
                  : `Fleet ${formatCurrency(data.fleet.averageFuelPerKm)}`
              }
              tone={
                data.fuelPerKm !== null &&
                data.fleet.averageFuelPerKm !== null &&
                data.fuelPerKm > data.fleet.averageFuelPerKm * 1.2
                  ? "bad"
                  : undefined
              }
            />
          </div>

          {/* ---- What the reader came to find out ---- */}
          {worst.length > 0 && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <p>
                This truck spends more of its budget on{" "}
                <span className="font-medium">
                  {worst.map((c) => c.category).join(", ")}
                </span>{" "}
                than the rest of the fleet does. {worst[0].category} is{" "}
                {worst[0].share}% of its costs against a fleet average of{" "}
                {worst[0].fleetShare}%.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---- The two usual culprits ---- */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Fuel className="h-4 w-4" /> Fuel economics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Fuel spend" value={formatCurrency(data.fuelSpend)} />
            <Row
              label="Per kilometre"
              value={data.fuelPerKm === null ? "—" : formatCurrency(data.fuelPerKm)}
            />
            <Row
              label="Per trip"
              value={
                data.trips > 0
                  ? formatCurrency(data.fuelSpend / data.trips)
                  : "—"
              }
            />
            <Row
              label="Share of all costs"
              value={
                data.expenses > 0
                  ? `${Math.round((data.fuelSpend / data.expenses) * 1000) / 10}%`
                  : "—"
              }
            />
            {data.fuelSpend === 0 && (
              <p className="pt-1 text-xs text-muted-foreground">
                No fuel costs found. Tag a category as &ldquo;Fuel &amp;
                lubricants&rdquo; under Expense Categories for this to fill in.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wrench className="h-4 w-4" /> Time in the workshop
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <Row label="Workshop spend" value={formatCurrency(data.maintenanceSpend)} />
            <Row label="Jobs raised" value={String(data.maintenanceJobs)} />
            <Row label="Still open" value={String(data.openJobs)} />
            <Row label="Days out of service" value={String(data.downtimeDays)} />
          </CardContent>
        </Card>
      </div>

      {/* ---- Every category, with the drill-down underneath ---- */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Costs by category</CardTitle>
        </CardHeader>
        <CardContent>
          {data.byCategory.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              No costs recorded against this truck in {periodLabel.toLowerCase()}.
            </p>
          ) : (
            <div className="space-y-1">
              {data.byCategory.map((category) => (
                <CategoryRow
                  key={category.categoryId}
                  category={category}
                  total={data.expenses}
                  open={openCategory === category.categoryId}
                  onToggle={() =>
                    setOpenCategory(
                      openCategory === category.categoryId
                        ? null
                        : category.categoryId,
                    )
                  }
                  expenses={data.expenses_list.filter(
                    (e) => e.categoryId === category.categoryId,
                  )}
                  truckId={truckId}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryRow({
  category,
  total,
  open,
  onToggle,
  expenses,
  truckId,
}: {
  category: CategoryCost;
  total: number;
  open: boolean;
  onToggle: () => void;
  expenses: TruckCostBreakdown["expenses_list"];
  truckId: string;
}) {
  const width = total > 0 ? (category.amount / total) * 100 : 0;

  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent/40"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{category.category}</span>
            {category.aboveFleetAverage && (
              <Badge
                variant="outline"
                className="border-amber-500/50 text-[10px] text-amber-700"
              >
                above fleet
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {category.count} expense{category.count === 1 ? "" : "s"}
            </span>
          </div>
          {/* A share bar, because "39% of costs" reads faster than a number */}
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={
                category.aboveFleetAverage ? "h-full bg-amber-500" : "h-full bg-primary"
              }
              style={{ width: `${width}%` }}
            />
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums">
            {formatCurrency(category.amount)}
          </p>
          <p className="text-xs text-muted-foreground">
            {category.share}%{" "}
            <span className="opacity-70">(fleet {category.fleetShare}%)</span>
          </p>
        </div>
      </button>

      {open && (
        <div className="border-t bg-muted/20 px-3 py-2">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Every {category.category.toLowerCase()} cost on this truck
            </p>
            <Link
              href={`/finance/expense-categories/${category.categoryId}?truckId=${truckId}`}
              className="text-xs text-primary hover:underline"
            >
              Open in category view →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Description</TableHead>
                  <TableHead className="text-xs">Source</TableHead>
                  <TableHead className="text-right text-xs">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={`${expense.id}-${expense.source}`}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {format(expense.date, "d MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-xs">
                      <Link
                        href={`/finance/expenses/${expense.id}`}
                        className="text-primary hover:underline"
                      >
                        {expense.description}
                      </Link>
                      {expense.supplier && (
                        <span className="text-muted-foreground"> · {expense.supplier}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {expense.source === "trip" && expense.tripId ? (
                        <Link
                          href={`/operations/trips/${expense.tripId}`}
                          className="inline-flex items-center gap-1 text-muted-foreground hover:underline"
                        >
                          <Route className="h-3 w-3" />
                          {expense.tripLabel}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Truck</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {formatCurrency(expense.attributed)}
                      {expense.sharedWith > 1 && (
                        <span
                          className="ml-1 text-muted-foreground"
                          title={`${formatCurrency(expense.amount)} split ${expense.sharedWith} ways`}
                        >
                          ⅟{expense.sharedWith}
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}

function Figure({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "good" | "bad";
}) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={
          tone === "bad"
            ? "text-xl font-bold text-destructive"
            : tone === "good"
              ? "text-xl font-bold text-emerald-600"
              : "text-xl font-bold"
        }
      >
        {value}
      </p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
