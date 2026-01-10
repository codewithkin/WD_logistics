import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { InviteUserForm } from "../_components/invite-form";

export default async function InviteUserPage() {
    await requireRole(["admin"]);

    return (
        <div>
            <PageHeader
                title="Add User"
                description="Add an existing user to your organization"
                backHref="/users"
            />
            <InviteUserForm />
        </div>
    );
}
