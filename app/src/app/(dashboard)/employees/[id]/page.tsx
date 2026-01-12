import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Mail, Phone, Building2, Calendar, DollarSign } from "lucide-react";
import { format, differenceInYears, differenceInMonths } from "date-fns";


interface EmployeeDetailPageProps {
    params: Promise<{ id: string }>;
}


export default async function EmployeeDetailPage({ params }: EmployeeDetailPageProps) {
    const { id } = await params;
    const session = await requireAuth();
    const { role, organizationId } = session;

    const employee = await prisma.employee.findFirst({
        where: { id, organizationId },
    });

    if (!employee) {
        notFound();
    }

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
            />

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

            </div>
        </div>
    );
}
