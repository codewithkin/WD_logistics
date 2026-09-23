import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, Truck as TruckIcon, FileText, IdCard } from "lucide-react";
import { format } from "date-fns";
import { AssignTruck } from "./_components/assign-truck";
import { ExportTrailerButton } from "./_components/export-trailer-button";
import { VehicleMaintenanceHistory } from "@/components/fleet/vehicle-maintenance-history";
import { UNFINISHED_STATUSES } from "@/app/(dashboard)/maintenance/_lib/status";
import { canViewFinancialData } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Wrench } from "lucide-react";

interface TrailerDetailPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function TrailerDetailPage({ params, searchParams }: TrailerDetailPageProps) {
    const { id } = await params;
    const query = await searchParams;
    const session = await requireAuth();
    const { role, organizationId } = session;
    const dateRange = getDateRangeFromParams(query, "3m");

    const trailer = await prisma.trailer.findFirst({
        where: { id, organizationId },
        include: {
            assignedTruck: true,
        },
    });

    if (!trailer) {
        notFound();
    }

    const canEdit = role === "admin" || role === "supervisor";
    // Same audience as the workshop screen: the office, not staff.
    const canViewMaintenance = role === "admin" || role === "supervisor";
    const showFinancials = canViewFinancialData(role);

    // A trailer can be maintained and can run up costs of its own, but the
    // page showed neither — so there was no way to ask whether one was worth
    // keeping. Both follow the period selector.
    const [maintenanceRequests, trailerExpenses] = await Promise.all([
        canViewMaintenance
            ? prisma.maintenanceRequest.findMany({
                  where: {
                      trailerId: id,
                      organizationId,
                      // Unfinished work stays visible however it is dated, so a
                      // job booked for next week doesn't fall off the page.
                      OR: [
                          { date: { gte: dateRange.from, lte: dateRange.to } },
                          { fixedAt: { gte: dateRange.from, lte: dateRange.to } },
                          { status: { in: [...UNFINISHED_STATUSES] } },
                      ],
                  },
                  include: {
                      assignedTo: { select: { name: true } },
                      fixedBy: { select: { name: true } },
                  },
                  orderBy: { date: "desc" },
              })
            : Promise.resolve([]),
        showFinancials
            ? prisma.trailerExpense.findMany({
                  where: {
                      trailerId: id,
                      expense: {
                          organizationId,
                          date: { gte: dateRange.from, lte: dateRange.to },
                      },
                  },
                  include: {
                      expense: {
                          include: { category: { select: { name: true } } },
                      },
                  },
                  orderBy: { expense: { date: "desc" } },
              })
            : Promise.resolve([]),
    ]);

    const expenseTotal = trailerExpenses.reduce((sum, te) => sum + te.expense.amount, 0);
    const expensesByCategory = Object.values(
        trailerExpenses.reduce<Record<string, { name: string; amount: number }>>((acc, te) => {
            const name = te.expense.category.name;
            (acc[name] ??= { name, amount: 0 }).amount += te.expense.amount;
            return acc;
        }, {})
    ).sort((a, b) => b.amount - a.amount);

    return (
        <div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <PageHeader
                    title={trailer.registrationNo}
                    description={`${trailer.make} ${trailer.model} (${trailer.year})`}
                    backHref="/fleet/trailers"
                    action={
                        canEdit
                            ? {
                                label: "Edit Trailer",
                                href: `/fleet/trailers/${trailer.id}/edit`,
                                icon: Pencil,
                            }
                            : undefined
                    }
                />
                <div className="flex items-center gap-2">
                    <PagePeriodSelector defaultPreset="3m" />
                    <ExportTrailerButton trailerId={trailer.id} trailerName={trailer.registrationNo} />
                </div>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Trailer Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <StatusBadge status={trailer.status} type="trailer" />
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Registration No.</span>
                            <span className="font-medium">{trailer.registrationNo}</span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Make / Model</span>
                            <span className="font-medium">
                                {trailer.make} {trailer.model}
                            </span>
                        </div>
                        <Separator />
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Year</span>
                            <span className="font-medium">{trailer.year}</span>
                        </div>
                        {trailer.type && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">Type</span>
                                    <span className="font-medium">{trailer.type}</span>
                                </div>
                            </>
                        )}
                        {trailer.licenseNumber && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground flex items-center gap-2">
                                        <IdCard className="h-4 w-4" /> License Number
                                    </span>
                                    <span className="font-medium">{trailer.licenseNumber}</span>
                                </div>
                            </>
                        )}
                        {trailer.licenseExpiration && (
                            <>
                                <Separator />
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground">License Expiration</span>
                                    <span className="font-medium">
                                        {format(trailer.licenseExpiration, "PPP")}
                                    </span>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <TruckIcon className="h-5 w-5" /> Assigned Truck
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {canEdit ? (
                            <AssignTruck
                                trailerId={trailer.id}
                                currentTruckId={trailer.assignedTruck?.id ?? null}
                                currentTruckName={
                                    trailer.assignedTruck
                                        ? `${trailer.assignedTruck.registrationNo} - ${trailer.assignedTruck.make} ${trailer.assignedTruck.model}`
                                        : null
                                }
                            />
                        ) : trailer.assignedTruck ? (
                            <div className="flex items-center gap-4">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                                    <TruckIcon className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <Link
                                        href={`/fleet/trucks/${trailer.assignedTruck.id}`}
                                        className="font-medium text-primary hover:underline"
                                    >
                                        {trailer.assignedTruck.registrationNo}
                                    </Link>
                                    <p className="text-sm text-muted-foreground">
                                        {trailer.assignedTruck.make} {trailer.assignedTruck.model}
                                    </p>
                                </div>
                            </div>
                        ) : (
                            <p className="text-muted-foreground">No truck assigned</p>
                        )}
                    </CardContent>
                </Card>

                {showFinancials && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Wrench className="h-5 w-5" /> Costs ({dateRange.label})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">Total spent</span>
                                <span className="font-medium">{formatCurrency(expenseTotal)}</span>
                            </div>
                            <Separator />
                            {expensesByCategory.length === 0 ? (
                                <p className="text-sm text-muted-foreground">
                                    No costs recorded against this trailer in this period.
                                </p>
                            ) : (
                                <div className="space-y-2">
                                    {expensesByCategory.map((row) => (
                                        <div key={row.name} className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">{row.name}</span>
                                            <span className="font-medium tabular-nums">
                                                {formatCurrency(row.amount)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {trailer.notes && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5" /> Notes
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground whitespace-pre-wrap">{trailer.notes}</p>
                        </CardContent>
                    </Card>
                )}
            </div>

            {canViewMaintenance && (
                <VehicleMaintenanceHistory
                    requests={maintenanceRequests}
                    periodLabel={dateRange.label}
                    vehicleLabel="trailer"
                />
            )}
        </div>
    );
}
