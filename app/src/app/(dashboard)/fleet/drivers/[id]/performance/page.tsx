import { notFound } from "next/navigation";
import Link from "next/link";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { canViewFinancialData } from "@/lib/permissions";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { getDriverPerformance } from "@/lib/metrics/driver-snapshots";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { ArrowRight, Truck } from "lucide-react";

interface PageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function DriverPerformancePage({ params, searchParams }: PageProps) {
    const { id } = await params;
    const query = await searchParams;
    // The whole page is money, so it is admin-only — the same rule
    // canViewFinancialData applies everywhere else.
    const session = await requireRole(["admin"]);
    const { organizationId } = session;
    // Item 25 says the default is three months.
    const dateRange = getDateRangeFromParams(query, "3m");

    const driver = await prisma.driver.findFirst({
        where: { id, organizationId },
        select: { id: true, firstName: true, lastName: true },
    });

    if (!driver) {
        notFound();
    }

    if (!canViewFinancialData(session.role)) {
        notFound();
    }

    const performance = await getDriverPerformance(organizationId, id, {
        from: dateRange.from,
        to: dateRange.to,
    });

    const name = `${driver.firstName} ${driver.lastName}`;
    const { cumulative, snapshots, unassigned, current } = performance;
    const loss = cumulative.profit < 0;

    // The timeline bar: each snapshot's width is its share of the period, so
    // a two-week stint doesn't look the same size as a six-month one.
    const totalDays = snapshots.reduce((sum, s) => sum + s.days, 0) || 1;

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <PageHeader
                    title={`${name} — performance`}
                    description={
                        current
                            ? `Currently on ${current.registrationNo} since ${format(current.since, "d MMM yyyy")}`
                            : "Not currently assigned a truck"
                    }
                    backHref={`/fleet/drivers/${driver.id}`}
                />
                <PagePeriodSelector defaultPreset="3m" />
            </div>

            {/* ---- Cumulative: the figure that carries across truck changes ---- */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Cumulative ({dateRange.label})
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        <Figure label="Trips" value={String(cumulative.trips)} />
                        <Figure label="Revenue" value={formatCurrency(cumulative.revenue)} />
                        <Figure label="Costs" value={formatCurrency(cumulative.expenses)} />
                        <Figure
                            label={loss ? "Loss" : "Profit"}
                            value={formatCurrency(Math.abs(cumulative.profit))}
                            tone={loss ? "bad" : "good"}
                        />
                        <Figure
                            label="Margin"
                            value={cumulative.margin === null ? "—" : `${cumulative.margin}%`}
                        />
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                        Each truck below starts from zero. This total carries across the
                        switches.
                    </p>
                </CardContent>
            </Card>

            {/* ---- The timeline of trucks ---- */}
            {snapshots.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Trucks in this period</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex h-10 w-full overflow-hidden rounded-md border">
                            {snapshots.map((snapshot, index) => (
                                <div
                                    key={snapshot.assignmentId ?? index}
                                    className="flex items-center justify-center border-r px-2 text-xs font-medium last:border-r-0"
                                    style={{
                                        width: `${(snapshot.days / totalDays) * 100}%`,
                                        // Alternating tints keep adjacent segments apart
                                        // without inventing a colour per truck.
                                        backgroundColor:
                                            index % 2 === 0
                                                ? "hsl(var(--primary) / 0.15)"
                                                : "hsl(var(--primary) / 0.07)",
                                    }}
                                    title={`${snapshot.registrationNo}: ${format(snapshot.clippedFrom, "d MMM")} – ${format(snapshot.clippedTo, "d MMM yyyy")}`}
                                >
                                    <span className="truncate">{snapshot.registrationNo}</span>
                                </div>
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                            {snapshots.map((snapshot, index) => (
                                <span
                                    key={snapshot.assignmentId ?? index}
                                    className="inline-flex items-center gap-1"
                                >
                                    {index > 0 && <ArrowRight className="h-3 w-3" />}
                                    {snapshot.registrationNo}{" "}
                                    {format(snapshot.clippedFrom, "d MMM")} –{" "}
                                    {snapshot.endDate
                                        ? format(snapshot.clippedTo, "d MMM yyyy")
                                        : "present"}
                                </span>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ---- One row per truck the driver had ---- */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">
                        Earnings by truck
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {snapshots.length === 0 ? (
                        <p className="py-10 text-center text-muted-foreground">
                            No truck assignments recorded for {name} in{" "}
                            {dateRange.label.toLowerCase()}.
                        </p>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Truck</TableHead>
                                        <TableHead>Period</TableHead>
                                        <TableHead className="text-right">Days</TableHead>
                                        <TableHead className="text-right">Trips</TableHead>
                                        <TableHead className="text-right">Revenue</TableHead>
                                        <TableHead className="text-right">Trip costs</TableHead>
                                        <TableHead className="text-right">Driver costs</TableHead>
                                        <TableHead className="text-right">Truck costs</TableHead>
                                        <TableHead className="text-right">Profit</TableHead>
                                        <TableHead className="text-right">Margin</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {snapshots.map((snapshot, index) => (
                                        <TableRow key={snapshot.assignmentId ?? index}>
                                            <TableCell>
                                                {snapshot.truckId ? (
                                                    <Link
                                                        href={`/fleet/trucks/${snapshot.truckId}`}
                                                        className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline"
                                                    >
                                                        <Truck className="h-3.5 w-3.5" />
                                                        {snapshot.registrationNo}
                                                    </Link>
                                                ) : (
                                                    snapshot.registrationNo
                                                )}
                                            </TableCell>
                                            <TableCell className="whitespace-nowrap text-sm">
                                                {format(snapshot.clippedFrom, "d MMM yyyy")} –{" "}
                                                {snapshot.endDate
                                                    ? format(snapshot.clippedTo, "d MMM yyyy")
                                                    : "present"}
                                                {snapshot.clipped && (
                                                    <Badge
                                                        variant="outline"
                                                        className="ml-1.5 text-[10px]"
                                                        title="This assignment extends beyond the selected period; the figures cover the visible part only."
                                                    >
                                                        clipped
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {snapshot.days}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {snapshot.trips}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(snapshot.revenue)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                {formatCurrency(snapshot.tripExpenses)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                {formatCurrency(snapshot.driverExpenses)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums text-muted-foreground">
                                                {formatCurrency(snapshot.truckExpenses)}
                                            </TableCell>
                                            <TableCell
                                                className={
                                                    snapshot.profit < 0
                                                        ? "text-right font-medium tabular-nums text-destructive"
                                                        : "text-right font-medium tabular-nums"
                                                }
                                            >
                                                {formatCurrency(snapshot.profit)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {snapshot.margin === null ? "—" : `${snapshot.margin}%`}
                                            </TableCell>
                                        </TableRow>
                                    ))}

                                    {/* The bucket exists so the total always reconciles. */}
                                    {(unassigned.trips > 0 || unassigned.revenue > 0) && (
                                        <TableRow className="text-muted-foreground">
                                            <TableCell
                                                colSpan={3}
                                                title="Trips and costs that fall outside any recorded assignment — usually a trip entered while the history said the driver had a different truck."
                                            >
                                                Outside any assignment
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {unassigned.trips}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(unassigned.revenue)}
                                            </TableCell>
                                            <TableCell colSpan={3} className="text-right tabular-nums">
                                                {formatCurrency(unassigned.expenses)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {formatCurrency(unassigned.revenue - unassigned.expenses)}
                                            </TableCell>
                                            <TableCell />
                                        </TableRow>
                                    )}

                                    <TableRow className="border-t-2 font-medium">
                                        <TableCell colSpan={3}>Cumulative</TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {cumulative.trips}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {formatCurrency(cumulative.revenue)}
                                        </TableCell>
                                        <TableCell colSpan={3} className="text-right tabular-nums">
                                            {formatCurrency(cumulative.expenses)}
                                        </TableCell>
                                        <TableCell
                                            className={
                                                loss
                                                    ? "text-right tabular-nums text-destructive"
                                                    : "text-right tabular-nums"
                                            }
                                        >
                                            {formatCurrency(cumulative.profit)}
                                        </TableCell>
                                        <TableCell className="text-right tabular-nums">
                                            {cumulative.margin === null ? "—" : `${cumulative.margin}%`}
                                        </TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

function Figure({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: "good" | "bad";
}) {
    return (
        <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p
                className={
                    tone === "bad"
                        ? "text-2xl font-bold text-destructive"
                        : tone === "good"
                          ? "text-2xl font-bold text-emerald-600"
                          : "text-2xl font-bold"
                }
            >
                {value}
            </p>
        </div>
    );
}
