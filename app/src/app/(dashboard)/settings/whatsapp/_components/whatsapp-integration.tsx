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
    const [isLoading, setIsLoading] = useState(false);
    const [isCheckingStatus, setIsCheckingStatus] = useState(true);

    const checkStatus = useCallback(async () => {
        try {
            const response = await fetch(
                `${AGENT_BASE_URL}/whatsapp/status?organizationId=${organizationId}`,
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                }
            );

            if (response.ok) {
                const data = await response.json();
                setState({
                    status: data.status || 'disconnected',
                    qrCode: data.qrCode || null,
                    error: data.error || null,
                    agentOnline: true,
                });
            } else {
                setState((prev) => ({
                    ...prev,
                    agentOnline: false,
                    status: 'disconnected',
                }));
            }
        } catch (error) {
            console.error('Failed to fetch WhatsApp status:', error);
            setState((prev) => ({
                ...prev,
                agentOnline: false,
                status: 'disconnected',
            }));
        } finally {
            setIsCheckingStatus(false);
        }
    }, [organizationId]);

    useEffect(() => {
        checkStatus();

        // Poll status every 5 seconds when connecting or showing QR
        const interval = setInterval(() => {
            if (state.status === 'connecting' || state.status === 'qr') {
                checkStatus();
            }
        }, 5000);

        return () => clearInterval(interval);
    }, [checkStatus, state.status]);

    const handleInitialize = async () => {
        setIsLoading(true);
        setState((prev) => ({ ...prev, error: null }));

        try {
            const response = await fetch(`${AGENT_BASE_URL}/whatsapp/initialize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ organizationId }),
            });

            const data = await response.json();

            if (data.success) {
                setState((prev) => ({
                    ...prev,
                    status: data.qrCode ? 'qr' : 'connecting',
                    qrCode: data.qrCode || null,
                }));
            } else {
                setState((prev) => ({
                    ...prev,
                    status: 'error',
                    error: data.message || 'Failed to initialize WhatsApp',
                }));
            }
        } catch (error) {
            console.error('Failed to initialize WhatsApp:', error);
            setState((prev) => ({
                ...prev,
                status: 'error',
                error: 'Failed to connect to agent server',
            }));
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusColor = (status: WhatsAppStatus): string => {
        switch (status) {
            case 'ready':
                return 'bg-green-500';
            case 'connecting':
            case 'qr':
                return 'bg-yellow-500';
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
    );
                                    className="w-64 h-64"
                                />
                            </div>
                            <p className="text-xs text-muted-foreground">
                                This QR code will expire. If it does, click &quot;Connect WhatsApp&quot; again.
                            </p>
                        </div>
                    )}

                    {state.status === 'connecting' && (
                        <div className="flex flex-col items-center space-y-2 py-4">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            <p className="text-sm text-muted-foreground">
                                Connecting to WhatsApp...
                            </p>
                        </div>
                    )}

                    {(state.status === 'disconnected' || state.status === 'error') && state.agentOnline && (
                        <Button
                            onClick={handleInitialize}
                            disabled={isLoading}
                            className="w-full"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Connecting...
                                </>
                            ) : (
                                <>
                                    <MessageCircle className="mr-2 h-4 w-4" />
                                    Connect WhatsApp
                                </>
                            )}
                        </Button>
                    )}

                    {!state.agentOnline && (
                        <p className="text-sm text-muted-foreground text-center">
                            Start the agent server to enable WhatsApp connection.
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
