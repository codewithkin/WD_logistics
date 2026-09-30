import { NoAccess } from "@/components/layout/no-access";
import { pageAccess } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsLayout } from "./_components/settings-layout";
import { GeneralSettings } from "./_components/general-settings";
import { NotificationsSettings } from "./_components/notifications-settings";
import { OrganisationSettings } from "./_components/organisation-settings";
import { MembersSettings } from "./_components/members-settings";
import { DangerZone } from "./_components/danger-zone";
import { getOrganizationMembers, getPendingInvitations } from "./actions";
import { isRootAdmin } from "@/lib/root-admin";

export default async function SettingsPage() {
    // Guard: Only admins can access settings
    const access = await pageAccess(["admin"]);
    if (!access.allowed) return <NoAccess role={access.role} what="settings" />;
    const session = access.session;

    const organization = await prisma.organization.findUnique({
        where: { id: session.organizationId },
    });

    if (!organization) {
        redirect("/dashboard");
    }

    // Parse metadata
    let metadata: Record<string, string> = {};
    if (organization.metadata) {
        try {
            metadata = JSON.parse(organization.metadata);
        } catch {
            metadata = {};
        }
    }

    // Fetch members and invitations
    const [membersResult, invitationsResult] = await Promise.all([
        getOrganizationMembers(),
        getPendingInvitations(),
    ]);

    const organisationData = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        email: metadata.email || "",
        phone: metadata.phone || "",
        address: metadata.address || "",
    };

    return (
        <SettingsLayout
            children={{
                general: (
                    <>
                        <GeneralSettings />
                        {/* One account can empty the system, and it is the
                            one the reset leaves standing. Any other admin
                            pressing this would delete their own account
                            halfway through the request. */}
                        {isRootAdmin(session.user.email) && <DangerZone />}
                    </>
                ),
                notifications: <NotificationsSettings />,
                organisation: <OrganisationSettings organisation={organisationData} />,
                members: (
                    <MembersSettings
                        members={membersResult.members || []}
                        invitations={invitationsResult.invitations || []}
                        currentUserId={session.user.id}
                    />
                ),
            }}
        />
    );
}
