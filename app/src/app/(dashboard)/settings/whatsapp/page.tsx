import { PageHeader } from '@/components/layout/page-header';
import { getServerSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { WhatsAppIntegration } from './_components/whatsapp-integration';

export default async function WhatsAppSettingsPage() {
    const session = await getServerSession();
    if (!session?.organizationId) {
        redirect('/sign-in');
    }

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
