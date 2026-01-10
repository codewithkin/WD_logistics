import { notFound } from "next/navigation";
import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeForm } from "../../_components/employee-form";

interface EditEmployeePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
    const { id } = await params;
    const session = await requireRole(["admin", "supervisor"]);

    const employee = await prisma.employee.findFirst({
        where: { id, organizationId: session.organizationId },
    });

    if (!employee) {
        notFound();
    }

    return (
        <div>
            <PageHeader
                title="Edit Employee"
                description={`${employee.firstName} ${employee.lastName}`}
                backHref={`/employees/${employee.id}`}
            />
            <EmployeeForm employee={employee} />
        </div>
    );
}
