"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
    MessageCircle,
    Loader2,
    RefreshCcw,
    Power,
    AlertTriangle,
    CheckCircle2,
    QrCode,
    WifiOff,
    Server,
    Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AgentStatus = "offline" | "online";
type WhatsAppStatus = "disconnected" | "connecting" | "ready" | "error";

interface WhatsAppState {
    agentStatus: AgentStatus;
    status: WhatsAppStatus;
    connected: boolean;
    phoneNumber: string | null;
    messagesSent: number;
    queuedMessages: number;
    lastError: string | null;
    qrCode: string | null;
}

interface WhatsAppIntegrationProps {
    organizationId: string;
}

const AGENT_BASE_URL = process.env.NEXT_PUBLIC_AGENT_URL || "http://localhost:3001";

export function WhatsAppIntegration({ organizationId }: WhatsAppIntegrationProps) {
    const [state, setState] = useState<WhatsAppState>({
        agentStatus: "offline",
        status: "disconnected",
        connected: false,
        phoneNumber: null,
        messagesSent: 0,
        queuedMessages: 0,
        lastError: null,
        qrCode: null,
    });
    const [isLoading, setIsLoading] = useState(true);
    const [isInitializing, setIsInitializing] = useState(false);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const response = await fetch(
                `${AGENT_BASE_URL}/whatsapp/status?organizationId=${organizationId}`,
                {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                    },
                }
            );

            if (!response.ok) {
                throw new Error("Agent not responding");
            }

            const data = await response.json();
            
            if (data.success) {
                setState({
                    agentStatus: "online",
                    status: data.status,
                    connected: data.connected,
                    phoneNumber: data.phoneNumber,
                    messagesSent: data.messagesSent || 0,
                    queuedMessages: data.queuedMessages || 0,
                    lastError: data.lastError,
                    qrCode: data.qrCode,
                });
            } else {
                setState((prev) => ({
                    ...prev,
                    agentStatus: "online",
                    lastError: data.error,
                }));
            }
            setLastChecked(new Date());
        } catch (error) {
            console.error("Failed to fetch WhatsApp status:", error);
            setState((prev) => ({
                ...prev,
                agentStatus: "offline",
                status: "disconnected",
                connected: false,
                lastError: "Agent server is not reachable",
            }));
            setLastChecked(new Date());
        } finally {
            setIsLoading(false);
        }
    }, [organizationId]);

    // Fetch initial status and poll
    useEffect(() => {
        fetchStatus();
        const interval = setInterval(fetchStatus, 5000); // Poll every 5 seconds
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const handleInitialize = async () => {
        setIsInitializing(true);
        try {
            const response = await fetch(`${AGENT_BASE_URL}/whatsapp/initialize`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ organizationId }),
            });

            const data = await response.json();
            
            if (data.success) {
                // Immediately fetch status to get QR code
                await fetchStatus();
            } else {
                setState((prev) => ({
                    ...prev,
                    lastError: data.error || "Failed to initialize",
                }));
            }
        } catch (error) {
            console.error("Failed to initialize WhatsApp:", error);
            setState((prev) => ({
                ...prev,
                lastError: "Failed to connect to agent",
            }));
        } finally {
            setIsInitializing(false);
        }
    };

    const getStatusColor = (status: WhatsAppStatus): string => {
        switch (status) {
            case "ready":
                return "bg-green-500";
            case "connecting":
                return "bg-blue-500";
            case "error":
                return "bg-red-500";
            default:
                return "bg-gray-500";
        }
    };

    const getStatusLabel = (status: WhatsAppStatus): string => {
        switch (status) {
            case "ready":
                return "Connected";
            case "connecting":
                return "Connecting...";
            case "error":
                return "Error";
            default:
                return "Disconnected";
        }
    };

    if (isLoading) {
        return (
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-lg" />
                        <div className="space-y-2">
                            <Skeleton className="h-5 w-40" />
                            <Skeleton className="h-4 w-60" />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-10 w-32" />
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
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-lg",
                                state.agentStatus === "online" ? "bg-green-500/10" : "bg-red-500/10"
                            )}>
                                <Server className={cn(
                                    "h-5 w-5",
                                    state.agentStatus === "online" ? "text-green-600" : "text-red-600"
                                )} />
                            </div>
                            <div>
                                <CardTitle>AI Agent Server</CardTitle>
                                <CardDescription>
                                    The backend service that handles WhatsApp communication
                                </CardDescription>
                            </div>
                        </div>
                        <Badge 
                            variant={state.agentStatus === "online" ? "default" : "destructive"}
                            className={state.agentStatus === "online" ? "bg-green-500" : ""}
                        >
                            {state.agentStatus === "online" ? "Online" : "Offline"}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent>
                    {state.agentStatus === "offline" && (
                        <Alert variant="destructive">
                            <WifiOff className="h-4 w-4" />
                            <AlertTitle>Agent Server Unavailable</AlertTitle>
                            <AlertDescription>
                                The AI agent server is not reachable. WhatsApp features will not work until the server is online.
                                Please check that the agent is deployed and running.
                            </AlertDescription>
                        </Alert>
                    )}
                    {state.agentStatus === "online" && (
                        <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
                            <CheckCircle2 className="h-4 w-4" />
                            <AlertDescription>
                                Agent server is online and ready to handle WhatsApp messages.
                            </AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>

            {/* WhatsApp Connection Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={cn(
                                "flex h-10 w-10 items-center justify-center rounded-lg",
                                state.connected ? "bg-green-500/10" : "bg-gray-500/10"
                            )}>
                                <MessageCircle className={cn(
                                    "h-5 w-5",
                                    state.connected ? "text-green-600" : "text-gray-600"
                                )} />
                            </div>
                            <div>
                                <CardTitle>WhatsApp Connection</CardTitle>
                                <CardDescription>
                                    Link your WhatsApp account to send notifications
                                </CardDescription>
                            </div>
                        </div>
                        <Badge className={getStatusColor(state.status)}>
                            {getStatusLabel(state.status)}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Connection Info */}
                    {state.connected && state.phoneNumber && (
                        <div className="rounded-lg bg-muted p-4">
                            <div className="flex items-center gap-3">
                                <Smartphone className="h-8 w-8 text-green-600" />
                                <div>
                                    <p className="font-medium">Connected Phone</p>
                                    <p className="text-sm text-muted-foreground">+{state.phoneNumber}</p>
                                </div>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">Messages Sent</p>
                                    <p className="text-lg font-semibold">{state.messagesSent}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">Queued Messages</p>
                                    <p className="text-lg font-semibold">{state.queuedMessages}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* QR Code Display */}
                    {state.agentStatus === "online" && !state.connected && state.qrCode && (
                        <div className="space-y-4">
                            <Alert className="border-blue-500/50 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100">
                                <QrCode className="h-4 w-4" />
                                <AlertTitle>Scan QR Code</AlertTitle>
                                <AlertDescription>
                                    Open WhatsApp on your phone and scan this QR code to connect
                                </AlertDescription>
                            </Alert>
                            
                            <div className="flex flex-col items-center gap-4 rounded-lg border bg-white p-6">
                                <img 
                                    src={state.qrCode} 
                                    alt="WhatsApp QR Code" 
                                    className="h-64 w-64"
                                />
                                <div className="text-center text-sm text-muted-foreground">
                                    <ol className="space-y-1 text-left">
                                        <li>1. Open WhatsApp on your phone</li>
                                        <li>2. Go to Settings → Linked Devices</li>
                                        <li>3. Tap &quot;Link a Device&quot;</li>
                                        <li>4. Point your camera at the QR code</li>
                                    </ol>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Waiting for QR */}
                    {state.agentStatus === "online" && !state.connected && !state.qrCode && state.status === "connecting" && (
                        <div className="flex flex-col items-center gap-4 rounded-lg border p-8">
                            <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                            <div className="text-center">
                                <p className="font-medium">Initializing WhatsApp...</p>
                                <p className="text-sm text-muted-foreground">
                                    Please wait while we prepare the QR code
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Error State */}
                    {state.lastError && state.status === "error" && (
                        <Alert variant="destructive">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Connection Error</AlertTitle>
                            <AlertDescription>{state.lastError}</AlertDescription>
                        </Alert>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-2">
                        {state.agentStatus === "online" && !state.connected && state.status !== "connecting" && (
                            <Button 
                                onClick={handleInitialize} 
                                disabled={isInitializing}
                                className="gap-2"
                            >
                                {isInitializing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Power className="h-4 w-4" />
                                )}
                                Connect WhatsApp
                            </Button>
                        )}

                        <Button 
                            variant="outline" 
                            onClick={fetchStatus}
                            disabled={isLoading}
                            className="gap-2"
                        >
                            <RefreshCcw className="h-4 w-4" />
                            Refresh Status
                        </Button>
                    </div>

                    {/* Last Updated */}
                    {lastChecked && (
                        <p className="text-xs text-muted-foreground">
                            Last updated: {lastChecked.toLocaleTimeString()}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Features List Card */}
            <Card>
                <CardHeader>
                    <CardTitle>WhatsApp Features</CardTitle>
                    <CardDescription>
                        What you can do with WhatsApp integration
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-3">
                        {[
                            { title: "Trip Assignments", description: "Notify drivers when they're assigned to new trips" },
                            { title: "Invoice Reminders", description: "Send payment reminders to customers" },
                            { title: "Payment Confirmations", description: "Confirm when payments are received" },
                            { title: "Delivery Updates", description: "Update customers on delivery status" },
                            { title: "Daily Schedules", description: "Send daily trip schedules to drivers" },
                        ].map((feature, i) => (
                            <li key={i} className="flex items-start gap-3">
                                <span className={cn(
                                    "mt-1.5 h-2 w-2 rounded-full flex-shrink-0",
                                    state.connected ? "bg-green-500" : "bg-gray-300"
                                )} />
                                <div>
                                    <p className="font-medium">{feature.title}</p>
                                    <p className="text-sm text-muted-foreground">{feature.description}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>
        </div>
    );
}
