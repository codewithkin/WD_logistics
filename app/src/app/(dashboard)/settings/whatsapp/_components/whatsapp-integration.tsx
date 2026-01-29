'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, MessageCircle, CheckCircle, XCircle, AlertTriangle, RefreshCw, Wifi, WifiOff } from 'lucide-react';

type WhatsAppStatus = 'disconnected' | 'connecting' | 'qr' | 'ready' | 'error';

interface WhatsAppState {
    status: WhatsAppStatus;
    qrCode: string | null;
    error: string | null;
    agentOnline: boolean;
}

interface WhatsAppIntegrationProps {
    organizationId: string;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

export function WhatsAppIntegration({ organizationId }: WhatsAppIntegrationProps) {
    const [state, setState] = useState<WhatsAppState>({
        status: 'disconnected',
        qrCode: null,
        error: null,
        agentOnline: false,
    });
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>WhatsApp Connection</CardTitle>
                <CardDescription>
                    To connect WhatsApp, scan the QR code shown in your agent terminal window.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Alert>
                    <AlertTitle>Check your agent terminal</AlertTitle>
                    <AlertDescription>
                        The WhatsApp QR code will appear in the terminal where your agent app is running. Open your agent terminal and scan the code with your WhatsApp app.
                    </AlertDescription>
                </Alert>
            </CardContent>
        </Card>
    )
}