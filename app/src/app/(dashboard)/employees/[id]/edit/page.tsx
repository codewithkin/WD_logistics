import { notFound } from "next/navigation";
// Staff reach the edit form too: their save becomes a request an admin
// accepts or refuses, rather than being refused at the door.
import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeForm } from "../../_components/employee-form";

interface EditEmployeePageProps {
    params: Promise<{ id: string }>;
}

export default async function EditEmployeePage({ params }: EditEmployeePageProps) {
    const { id } = await params;
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="editing an employee" />;
    const session = access.session;

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
