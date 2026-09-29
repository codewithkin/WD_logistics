import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { InviteUserForm } from "../_components/invite-form";

export default async function InviteUserPage() {
    const access = await pageAccess(["admin"]);
    if (!access.allowed) return <NoAccess role={access.role} what="inviting a user" />;

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
