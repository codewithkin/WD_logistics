import { NextRequest, NextResponse } from 'next/server';
import { initializeWhatsApp } from '@/lib/whatsapp';
import { getServerSession } from '@/lib/session';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const result = await initializeWhatsApp(session.organizationId);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error initializing WhatsApp:', error);
    return NextResponse.json(
      { error: 'Failed to initialize WhatsApp' },
      { status: 500 }
    );
  }
}
