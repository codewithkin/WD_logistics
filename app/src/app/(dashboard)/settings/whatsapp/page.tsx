import { requireRole } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { WhatsAppIntegration } from "./_components/whatsapp-integration";

export const dynamic = "force-dynamic";

export default async function WhatsAppSettingsPage() {
    const session = await requireRole(["admin"]);

    return (
        <div className="space-y-6">
            <PageHeader
                title="WhatsApp Integration"
                description="Connect and manage WhatsApp for customer and driver notifications"
            />
            <WhatsAppIntegration organizationId={session.organizationId} />
        </div>
    );
}
