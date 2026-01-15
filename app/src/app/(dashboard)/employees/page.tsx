import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeesTable } from "./_components/employees-table";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function EmployeesPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const employees = await prisma.employee.findMany({
        where: { organizationId },
        orderBy: { firstName: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <PageHeader
                    title="Employees"
                    description="Manage employee records"
                />
                {canCreate && (
                    <Link href="/employees/new">
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Employee
                        </Button>
                    </Link>
                )}
            </div>
            <EmployeesTable employees={employees} role={role} />
        </div>
    );
}
