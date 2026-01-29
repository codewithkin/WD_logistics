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
            case 'error':
                return 'bg-red-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getStatusLabel = (status: WhatsAppStatus): string => {
        switch (status) {
            case 'ready':
                return 'Connected';
            case 'connecting':
                return 'Connecting...';
            case 'qr':
                return 'Scan QR Code';
            case 'error':
                return 'Error';
            default:
                return 'Disconnected';
        }
    };

    const getStatusIcon = (status: WhatsAppStatus) => {
        switch (status) {
            case 'ready':
                return <CheckCircle className="h-5 w-5 text-green-500" />;
            case 'connecting':
            case 'qr':
                return <Loader2 className="h-5 w-5 text-yellow-500 animate-spin" />;
            case 'error':
                return <XCircle className="h-5 w-5 text-red-500" />;
            default:
                return <MessageCircle className="h-5 w-5 text-gray-500" />;
        }
    };

    if (isCheckingStatus) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" />
                    <span>Checking WhatsApp status...</span>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Agent Status Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {state.agentOnline ? (
                                <Wifi className="h-5 w-5 text-green-500" />
                            ) : (
                                <WifiOff className="h-5 w-5 text-red-500" />
                            )}
                            <CardTitle>Agent Server Status</CardTitle>
                        </div>
                        <Button variant="outline" size="sm" onClick={checkStatus}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh
                        </Button>
                    </div>
                    <CardDescription>
                        The backend service that handles WhatsApp communication
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {state.agentOnline ? (
                        <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Online</AlertTitle>
                            <AlertDescription>
                                Agent server is online and ready to handle WhatsApp messages.
                            </AlertDescription>
                        </Alert>
                    ) : (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Offline</AlertTitle>
                            <AlertDescription>
                                The AI agent server is not reachable. WhatsApp features will not work until the server is online.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* WhatsApp Connection Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {getStatusIcon(state.status)}
                            <CardTitle>WhatsApp Connection</CardTitle>
                        </div>
                        <Badge className={getStatusColor(state.status)}>
                            {getStatusLabel(state.status)}
                        </Badge>
                    </div>
                    <CardDescription>
                        Link your WhatsApp account to send notifications
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {state.error && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{state.error}</AlertDescription>
                        </Alert>
                    )}

                    {state.status === 'ready' && (
                        <Alert>
                            <CheckCircle className="h-4 w-4" />
                            <AlertTitle>Connected</AlertTitle>
                            <AlertDescription>
                                WhatsApp is connected and ready to send messages.
                            </AlertDescription>
                        </Alert>
                    )}

                    {state.status === 'qr' && state.qrCode && (
                        <div className="flex flex-col items-center space-y-4">
                            <p className="text-sm text-muted-foreground text-center">
                                Open WhatsApp on your phone and scan this QR code to connect
                            </p>
                            <div className="bg-white p-4 rounded-lg shadow-sm">
                                <img
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&data=${encodeURIComponent(state.qrCode)}`}
                                    alt="WhatsApp QR Code"
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
