import { PageHeader } from '@/components/layout/page-header';
import { pageAccess } from '@/lib/session';
import { NoAccess } from '@/components/layout/no-access';
import { WhatsAppIntegration } from './_components/whatsapp-integration';

export default async function WhatsAppSettingsPage() {
    // Admin only. This page had no role check at all — any signed-in user,
    // workshop included, could reach the WhatsApp pairing screen.
    const access = await pageAccess(['admin']);
    if (!access.allowed) {
        return <NoAccess role={access.role} what="WhatsApp settings" />;
    }
    const { session } = access;

    return (
        <div className="space-y-6">
            <PageHeader
                title="WhatsApp Integration"
                description="Connect your WhatsApp account to send notifications to drivers and customers"
            />

            <WhatsAppIntegration organizationId={session.organizationId} />
        </div>
    );
}
