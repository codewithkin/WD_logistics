import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { SettingsLayout } from "./_components/settings-layout";
import { GeneralSettings } from "./_components/general-settings";
import { NotificationsSettings } from "./_components/notifications-settings";
import { OrganisationSettings } from "./_components/organisation-settings";
import { MembersSettings } from "./_components/members-settings";
import { getOrganizationMembers, getPendingInvitations } from "./actions";

export default async function SettingsPage() {
    // Guard: Only admins can access settings
    const session = await requireRole(["admin"]);

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

    const generalSettings = {
        currency: metadata.currency || "USD",
        timezone: metadata.timezone || "UTC",
    };

    const defaultNotificationPreferences = {
        emailNotifications: true,
        tripUpdates: true,
        invoiceReminders: true,
        maintenanceAlerts: true,
        driverLicenseExpiry: true,
    };

    return (
        <SettingsLayout
            children={{
                general: (
                    <GeneralSettings
                        settings={generalSettings}
                        organizationName={organization.name}
                    />
                ),
                notifications: (
                    <NotificationsSettings preferences={defaultNotificationPreferences} />
                ),
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
