import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { EmployeeForm } from "../_components/employee-form";

export default async function NewEmployeePage() {
    await requireRole(["admin", "supervisor"]);

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
