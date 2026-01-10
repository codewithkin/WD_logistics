import { requireAuth } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeesTable } from "./_components/employees-table";
import { Plus } from "lucide-react";

export default async function EmployeesPage() {
    const session = await requireAuth();
    const { role, organizationId } = session;

    const employees = await prisma.employee.findMany({
        where: { organizationId },
        include: {
            driver: {
                select: { id: true, name: true },
            },
        },
        orderBy: { firstName: "asc" },
    });

    const canCreate = role === "admin" || role === "supervisor";

    return (
        <div>
            <PageHeader
                title="Employees"
                description="Manage employee records"
                action={
                    canCreate
                        ? {
                            label: "Add Employee",
                            href: "/employees/new",
                            icon: Plus,
                        }
                        : undefined
                }
            />
            <EmployeesTable employees={employees} role={role} />
        </div>
    );
}
