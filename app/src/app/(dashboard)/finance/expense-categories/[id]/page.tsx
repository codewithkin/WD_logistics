import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
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
import { ArrowDown, ArrowUp, Minus, Tags } from "lucide-react";
import { getCategoryDetail } from "../_lib/category-detail";
import { CategoryExpenseFilters } from "../_components/category-expense-filters";
import { CategoryMonthlyChart } from "../_components/category-monthly-chart";
import { ExportCategoryButton } from "../_components/export-category-button";

interface CategoryDetailPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{
        period?: string;
        from?: string;
        to?: string;
        truckId?: string;
        trailerId?: string;
        tripId?: string;
        driverId?: string;
        supplierId?: string;
        paid?: string;
    }>;
}

export default async function CategoryDetailPage({
    params,
    searchParams,
}: CategoryDetailPageProps) {
    const { id } = await params;
    const query = await searchParams;
    // Expense categories are the chart of accounts, so supervisors read them
    // too; only admin may change one (see canManageExpenseCategories).
    const session = await requireRole(["admin", "supervisor"]);
    const { organizationId } = session;
    const dateRange = getDateRangeFromParams(query, "3m");

    const category = await prisma.expenseCategory.findFirst({
        where: { id, organizationId },
        include: { defaultAccount: { select: { name: true } } },
    });

    if (!category) {
        notFound();
    }

    const filters = {
        truckId: query.truckId,
        trailerId: query.trailerId,
        tripId: query.tripId,
        driverId: query.driverId,
        supplierId: query.supplierId,
        paid: query.paid,
    };

    // The filter pickers need a label for whatever is already selected, and
    // those are the only records loaded here — the pickers search for the rest.
    const [detail, truck, trailer, trip, driver, supplier] = await Promise.all([
        getCategoryDetail(organizationId, category.id, dateRange, filters),
        filters.truckId
            ? prisma.truck.findFirst({
                  where: { id: filters.truckId, organizationId },
                  select: { id: true, registrationNo: true, make: true, model: true },
              })
            : null,
        filters.trailerId
            ? prisma.trailer.findFirst({
                  where: { id: filters.trailerId, organizationId },
                  select: { id: true, registrationNo: true, make: true, model: true },
              })
            : null,
        filters.tripId
            ? prisma.trip.findFirst({
                  where: { id: filters.tripId, organizationId },
                  select: {
                      id: true,
                      originCity: true,
                      destinationCity: true,
                      scheduledDate: true,
                  },
              })
            : null,
        filters.driverId
            ? prisma.driver.findFirst({
                  where: { id: filters.driverId, organizationId },
                  select: { id: true, firstName: true, lastName: true, phone: true },
              })
            : null,
        filters.supplierId
            ? prisma.supplier.findFirst({
                  where: { id: filters.supplierId, organizationId },
                  select: { id: true, name: true, contactPerson: true },
              })
            : null,
    ]);

    const appliesTo = [
        category.isTrip ? "Trips" : null,
        category.isTruck ? "Trucks" : null,
        category.isDriver ? "Drivers" : null,
    ].filter(Boolean);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title={category.name}
                    description={
                        category.description ||
                        `Every expense in this category — ${dateRange.label}`
                    }
                    backHref="/finance/expense-categories"
                />
                <div className="flex items-center gap-2">
                    <PagePeriodSelector defaultPreset="3m" />
                    <ExportCategoryButton categoryId={category.id} />
                </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <SummaryCard
                    label="Total spent"
                    value={formatCurrency(detail.total)}
                    hint={dateRange.label}
                />
                <SummaryCard
                    label="Expenses"
                    value={String(detail.count)}
                    hint={
                        detail.count > 0
                            ? `${formatCurrency(detail.average)} on average`
                            : "Nothing recorded"
                    }
                />
                <SummaryCard
                    label="Still unpaid"
                    value={formatCurrency(detail.unpaid)}
                    hint={`${formatCurrency(detail.paid)} already paid`}
                    tone={detail.unpaid > 0 ? "warn" : undefined}
                />
                <TrendCard
                    current={detail.total}
                    previous={detail.previousTotal}
                    changePercent={detail.changePercent}
                />
            </div>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Tags className="h-4 w-4" /> Spend by month
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <CategoryMonthlyChart data={detail.monthly} />
                </CardContent>
            </Card>

            <Card>
                <CardContent className="pt-6">
                    <CategoryExpenseFilters
                        values={filters}
                        labels={{
                            truck: truck
                                ? {
                                      id: truck.id,
                                      label: truck.registrationNo,
                                      description: `${truck.make} ${truck.model}`,
                                  }
                                : undefined,
                            trailer: trailer
                                ? {
                                      id: trailer.id,
                                      label: trailer.registrationNo,
                                      description: `${trailer.make} ${trailer.model}`,
                                  }
                                : undefined,
                            trip: trip
                                ? {
                                      id: trip.id,
                                      label: `${trip.originCity} → ${trip.destinationCity}`,
                                      description: format(trip.scheduledDate, "d MMM yyyy"),
                                  }
                                : undefined,
                            driver: driver
                                ? {
                                      id: driver.id,
                                      label: `${driver.firstName} ${driver.lastName}`,
                                      description: driver.phone,
                                  }
                                : undefined,
                            supplier: supplier
                                ? {
                                      id: supplier.id,
                                      label: supplier.name,
                                      description: supplier.contactPerson ?? undefined,
                                  }
                                : undefined,
                        }}
                    />

                    <Separator className="my-4" />

                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm text-muted-foreground">
                            {detail.count} expense{detail.count === 1 ? "" : "s"},{" "}
                            {formatCurrency(detail.total)}
                            {detail.truncated
                                ? ` — showing the most recent ${detail.rows.length}`
                                : ""}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                            {appliesTo.length > 0 && (
                                <Badge variant="outline">
                                    Applies to {appliesTo.join(", ")}
                                </Badge>
                            )}
                            {category.defaultAccount && (
                                <Badge variant="outline">
                                    Draws from {category.defaultAccount.name}
                                </Badge>
                            )}
                        </div>
                    </div>

                    {detail.rows.length === 0 ? (
                        <p className="py-10 text-center text-muted-foreground">
                            No expenses match these filters in {dateRange.label.toLowerCase()}.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Description</TableHead>
                                        <TableHead>Linked to</TableHead>
                                        <TableHead>Supplier</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {detail.rows.map((row) => (
                                        <TableRow key={row.id}>
                                            <TableCell className="whitespace-nowrap">
                                                {format(row.date, "d MMM yyyy")}
                                            </TableCell>
                                            <TableCell className="max-w-xs">
                                                <Link
                                                    href={`/finance/expenses/${row.id}`}
                                                    className="font-medium text-primary hover:underline"
                                                >
                                                    {row.description}
                                                </Link>
                                                {row.vendor && (
                                                    <p className="text-xs text-muted-foreground">
                                                        {row.vendor}
                                                    </p>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1">
                                                    {row.trucks.map((t) => (
                                                        <Link key={t.id} href={`/fleet/trucks/${t.id}`}>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {t.registrationNo}
                                                            </Badge>
                                                        </Link>
                                                    ))}
                                                    {row.trailers.map((t) => (
                                                        <Link key={t.id} href={`/fleet/trailers/${t.id}`}>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {t.registrationNo}
                                                            </Badge>
                                                        </Link>
                                                    ))}
                                                    {row.trips.map((t) => (
                                                        <Link key={t.id} href={`/operations/trips/${t.id}`}>
                                                            <Badge variant="outline" className="text-xs">
                                                                {t.label}
                                                            </Badge>
                                                        </Link>
                                                    ))}
                                                    {row.drivers.map((d) => (
                                                        <Link key={d.id} href={`/fleet/drivers/${d.id}`}>
                                                            <Badge variant="outline" className="text-xs">
                                                                {d.name}
                                                            </Badge>
                                                        </Link>
                                                    ))}
                                                    {row.isShared && (
                                                        <Badge
                                                            variant="outline"
                                                            className="text-xs"
                                                            title="Split evenly across the records it names when attributed to one of them"
                                                        >
                                                            shared
                                                        </Badge>
                                                    )}
                                                    {row.trucks.length === 0 &&
                                                        row.trailers.length === 0 &&
                                                        row.trips.length === 0 &&
                                                        row.drivers.length === 0 && (
                                                            <span className="text-xs text-muted-foreground">
                                                                Business expense
                                                            </span>
                                                        )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {row.supplier ? (
                                                    <Link
                                                        href={`/suppliers/${row.supplier.id}`}
                                                        className="hover:underline"
                                                    >
                                                        {row.supplier.name}
                                                    </Link>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={row.isPaid ? "secondary" : "outline"}>
                                                    {row.isPaid ? "Paid" : "Unpaid"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-medium tabular-nums">
                                                {formatCurrency(row.amount)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function SummaryCard({
    label,
    value,
    hint,
    tone,
}: {
    label: string;
    value: string;
    hint?: string;
    tone?: "warn";
}) {
    return (
        <Card>
            <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">{label}</p>
                <p
                    className={
                        tone === "warn"
                            ? "text-2xl font-bold text-amber-600"
                            : "text-2xl font-bold"
                    }
                >
                    {value}
                </p>
                {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
            </CardContent>
        </Card>
    );
}

/**
 * Period-on-period change. The comparison window is the same length as the
 * selected one and sits immediately before it, so a 3-month view is compared
 * with the 3 months before it rather than with a fixed calendar month.
 */
function TrendCard({
    current,
    previous,
    changePercent,
}: {
    current: number;
    previous: number;
    changePercent: number | null;
}) {
    const Icon =
        changePercent === null
            ? Minus
            : changePercent > 0
              ? ArrowUp
              : changePercent < 0
                ? ArrowDown
                : Minus;

    // Spending more is bad news here, so the colours are inverted relative to
    // a revenue card.
    const tone =
        changePercent === null || changePercent === 0
            ? "text-muted-foreground"
            : changePercent > 0
              ? "text-amber-600"
              : "text-emerald-600";

    return (
        <Card>
            <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">vs previous period</p>
                <p className={`flex items-center gap-1 text-2xl font-bold ${tone}`}>
                    <Icon className="h-5 w-5" />
                    {changePercent === null
                        ? "—"
                        : `${changePercent > 0 ? "+" : ""}${changePercent.toFixed(1)}%`}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                    {previous > 0
                        ? `was ${formatCurrency(previous)}`
                        : "nothing in the previous window"}
                    {current === 0 && previous === 0 ? "" : ""}
                </p>
            </CardContent>
        </Card>
    );
}
