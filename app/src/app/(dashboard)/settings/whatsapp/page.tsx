import { PageHeader } from '@/components/layout/page-header';
import { pageAccess } from '@/lib/session';
import { NoAccess } from '@/components/layout/no-access';
import { WhatsAppIntegration } from './_components/whatsapp-integration';
import { WhatsAppContacts } from '../_components/whatsapp-contacts';

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
                description="Pair the phone, and choose who the assistant answers."
            />

            <WhatsAppIntegration organizationId={session.organizationId} />

            {/* Who the bot replies to lives here, next to the pairing it
                depends on, rather than buried under Notifications where
                nobody found it. */}
            <WhatsAppContacts />
        </div>
    );
}
