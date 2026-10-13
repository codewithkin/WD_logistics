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

    // Read from the columns the documents print, not from the metadata blob the
    // form used to write: an admin correcting the address in Settings was
    // updating a field nothing read, while every invoice carried on printing
    // the hardcoded fallback. The blob's old values are the fallback here, so
    // whatever was typed before this change still shows up in the form.
    const organisationData = {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        logo: organization.logo,
        email: organization.email || metadata.email || "",
        phone: organization.phone || metadata.phone || "",
        altPhone: organization.altPhone || "",
        website: organization.website || "",
        addressLine1: organization.addressLine1 || metadata.address || "",
        addressLine2: organization.addressLine2 || "",
        city: organization.city || "",
        country: organization.country || "",
        vatNumber: organization.vatNumber || "",
        bpNumber: organization.bpNumber || "",
        bankDetails: organization.bankDetails || "",
        invoiceTerms: organization.invoiceTerms || "",
    };

    return (
        <SettingsLayout
            children={{
                general: (
                    <>
                        <GeneralSettings />
                        <DangerZone />
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
