import { notFound } from "next/navigation";
import Link from "next/link";
import { pageAccess } from "@/lib/session";
import { NoAccess } from "@/components/layout/no-access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { canViewInventoryValue } from "@/lib/permissions";
import { formatCurrency } from "@/lib/utils";
import { Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building2, Calendar, DollarSign } from "lucide-react";
import { format, differenceInYears, differenceInMonths } from "date-fns";


interface EmployeeDetailPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}


export default async function EmployeeDetailPage({ params, searchParams }: EmployeeDetailPageProps) {
    const { id } = await params;
    const query = await searchParams;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) {
        return <NoAccess role={access.role} what="employee details" />;
    }
    const session = access.session;
    const { role, organizationId } = session;
    const dateRange = getDateRangeFromParams(query, "3m");

    const employee = await prisma.employee.findFirst({
        where: { id, organizationId },
    });

    if (!employee) {
        notFound();
    }

    // What this employee has issued out of the warehouse. It was recorded
    // against them on every allocation but never shown anywhere, so there was
    // no way to ask who had been drawing parts.
    const canSeeValue = canViewInventoryValue(role);
    const allocations = await prisma.partAllocation.findMany({
        where: {
            allocatedById: employee.id,
            allocatedAt: { gte: dateRange.from, lte: dateRange.to },
        },
        include: {
            inventoryItem: { select: { id: true, name: true, unit: true, unitCost: true } },
            truck: { select: { id: true, registrationNo: true } },
        },
        orderBy: { allocatedAt: "desc" },
        take: 25,
    });

    const allocationValue = canSeeValue
        ? allocations.reduce(
              (sum, a) => sum + (a.inventoryItem.unitCost ?? 0) * a.quantity,
              0,
          )
        : null;

    const canEdit = role === "admin" || role === "supervisor";

    // Calculate tenure
    const years = differenceInYears(new Date(), employee.startDate);
    const months = differenceInMonths(new Date(), employee.startDate) % 12;
    const tenure =
        years > 0
            ? `${years} year${years > 1 ? "s" : ""}${months > 0 ? `, ${months} month${months > 1 ? "s" : ""}` : ""}`
            : `${months} month${months > 1 ? "s" : ""}`;

    return (
        <div>
            <PageHeader
                title={`${employee.firstName} ${employee.lastName}`}
                description={employee.position}
                backHref="/employees"
                action={
                    canEdit
                        ? {
                            label: "Edit Employee",
                            href: `/employees/${employee.id}/edit`,
                        }
                        : undefined
                }
            >
                <PagePeriodSelector defaultPreset="3m" />
            </PageHeader>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Employee Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">Status</span>
                            <StatusBadge status={employee.status} type="employee" />
                        </div>
                        <Separator />
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <Building2 className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Department</p>
                                    <p className="font-medium">{employee.department || "—"}</p>
                                </div>
                            </div>
                            {employee.email && (
                                <div className="flex items-center gap-3">
                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <a
                                            href={`mailto:${employee.email}`}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {employee.email}
                                        </a>
                                    </div>
                                </div>
                            )}
                            {employee.phone && (
                                <div className="flex items-center gap-3">
                                    <Phone className="h-4 w-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Phone</p>
                                        <a
                                            href={`tel:${employee.phone}`}
                                            className="font-medium text-primary hover:underline"
                                        >
                                            {employee.phone}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Employment Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-3">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                                <p className="text-sm text-muted-foreground">Start Date</p>
                                <p className="font-medium">
                                    {format(employee.startDate, "MMMM d, yyyy")}
                                </p>
                                <p className="text-sm text-muted-foreground">Tenure: {tenure}</p>
                            </div>
                        </div>
                        {employee.endDate && (
                            <div className="flex items-center gap-3">
                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">End Date</p>
                                    <p className="font-medium">
                                        {format(employee.endDate, "MMMM d, yyyy")}
                                    </p>
                                </div>
                            </div>
                        )}
                        {employee.salary && (
                            <div className="flex items-center gap-3">
                                <DollarSign className="h-4 w-4 text-muted-foreground" />
                                <div>
                                    <p className="text-sm text-muted-foreground">Salary</p>
                                    <p className="font-medium">${employee.salary.toLocaleString()}</p>
                                </div>
                            </div>
                        )}
                        {employee.notes && (
                            <>
                                <Separator />
                                <div>
                                    <p className="text-sm text-muted-foreground mb-1">Notes</p>
                                    <p className="text-sm">{employee.notes}</p>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Package className="h-5 w-5" /> Parts issued ({dateRange.label})
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {allocations.length === 0 ? (
                            <p className="py-4 text-center text-muted-foreground">
                                No parts issued by this employee in this period.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {allocationValue !== null && (
                                    <p className="text-sm text-muted-foreground">
                                        {allocations.length} allocation
                                        {allocations.length === 1 ? "" : "s"}, worth{" "}
                                        <span className="font-medium text-foreground">
                                            {formatCurrency(allocationValue)}
                                        </span>
                                    </p>
                                )}
                                {allocations.map((allocation) => (
                                    <div
                                        key={allocation.id}
                                        className="flex flex-wrap items-center justify-between gap-2 border-b pb-3 last:border-0 last:pb-0"
                                    >
                                        <div className="min-w-0">
                                            <Link
                                                href={`/inventory/${allocation.inventoryItem.id}`}
                                                className="font-medium text-primary hover:underline"
                                            >
                                                {allocation.inventoryItem.name}
                                            </Link>
                                            <p className="text-sm text-muted-foreground">
                                                {allocation.quantity} {allocation.inventoryItem.unit ?? "units"}
                                                {" to "}
                                                <Link
                                                    href={`/fleet/trucks/${allocation.truck.id}`}
                                                    className="hover:underline"
                                                >
                                                    {allocation.truck.registrationNo}
                                                </Link>
                                            </p>
                                        </div>
                                        <span className="text-sm text-muted-foreground">
                                            {format(allocation.allocatedAt, "d MMM yyyy")}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
