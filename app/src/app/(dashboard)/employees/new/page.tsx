import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeForm } from "../_components/employee-form";

export default async function NewEmployeePage() {
    const access = await pageAccess(["admin", "supervisor"]);
    if (!access.allowed) return <NoAccess role={access.role} what="adding an employee" />;

    return (
        <div>
            <PageHeader
                title="Add Employee"
                description="Add a new employee to your organization"
                backHref="/employees"
            />
            <EmployeeForm />
        </div>
    );
}
