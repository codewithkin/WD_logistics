import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { CreateSupervisorForm } from "./_components/supervisor-form";

export default async function NewSupervisorPage() {
    await requireRole(["admin"]);

    return (
        <div>
            <PageHeader
                title="Add Supervisor"
                description="Create a new supervisor account. They will receive login credentials via email."
                backHref="/users"
            />
            <CreateSupervisorForm />
        </div>
    );
}
