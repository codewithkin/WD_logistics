import { pageAccess } from "@/lib/session";
import { NoAccess } from "@/components/layout/no-access";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { PagePeriodSelector } from "@/components/ui/page-period-selector";
import { getDateRangeFromParams } from "@/lib/period-utils";
import { EmployeesTable } from "./_components/employees-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface EmployeesPageProps {
    searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}

export default async function EmployeesPage({ searchParams }: EmployeesPageProps) {
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) {
        return <NoAccess role={access.role} what="employees" />;
    }
    const session = access.session;
    const { role, organizationId } = session;
    const params = await searchParams;
    const dateRange = getDateRangeFromParams(params, "1y");

    // The period narrows by when someone joined, but anyone still on the books
    // stays visible however long ago they started — otherwise a 3-month view
    // shows an empty staff list.
    const employees = await prisma.employee.findMany({
        where: {
            organizationId,
            OR: [
                { startDate: { gte: dateRange.from, lte: dateRange.to } },
                { endDate: { gte: dateRange.from, lte: dateRange.to } },
                { endDate: null },
            ],
        },
        orderBy: { firstName: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Employees"
                    description={`Employee records — ${dateRange.label}`}
                />
                <div className="flex items-center gap-2">
                <PagePeriodSelector defaultPreset="1y" />
                {canCreate && (
                    <Link href="/employees/new" prefetch className="w-full sm:w-auto">
                        <Button className="w-full sm:w-auto">
                            <Plus className="h-4 w-4 mr-2" />
                            Add Employee
                        </Button>
                    </Link>
                )}
                </div>
            </div>
            <EmployeesTable employees={employees} role={role} />
        </div>
    );
}
