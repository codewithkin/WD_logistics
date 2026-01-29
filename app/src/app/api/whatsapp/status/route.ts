import { NextRequest, NextResponse } from 'next/server';
import { getWhatsAppStatus } from '@/lib/whatsapp';
import { getServerSession } from '@/lib/session';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const status = getWhatsAppStatus();

    // Only return status if it matches the current organization
    if (status.organizationId !== session.organizationId) {
      return NextResponse.json({
        status: 'disconnected',
        qrCode: null,
        error: null,
      });
    }

    return NextResponse.json(status);
  } catch (error) {
    console.error('Error getting WhatsApp status:', error);
    return NextResponse.json(
      { error: 'Failed to get WhatsApp status' },
      { status: 500 }
    );
  }
}
