import { requireRole } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { SettingsForm } from "./_components/settings-form";
import { WhatsAppStatus } from "@/components/settings/whatsapp-status";
import { SettingsLayout } from "./_components/settings-layout";

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

    return (
        <div className="space-y-6">
            <PageHeader
                title="Settings"
                description="Manage organization settings and preferences"
            />
            <SettingsLayout>
                <div className="space-y-6">
                    <SettingsForm
                        organization={{
                            id: organization.id,
                            name: organization.name,
                            slug: organization.slug,
                            logo: organization.logo,
                            address: metadata.address || "",
                            phone: metadata.phone || "",
                            email: metadata.email || "",
                            currency: metadata.currency || "USD",
                            timezone: metadata.timezone || "UTC",
                        }}
                    />
                    <WhatsAppStatus />
                </div>
            </SettingsLayout>
        </div>
    );
}
