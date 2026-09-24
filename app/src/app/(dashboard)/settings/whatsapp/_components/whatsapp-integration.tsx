'use client';

import Image from 'next/image';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    AlertTriangle,
    CheckCircle,
    Loader2,
    RefreshCw,
    Smartphone,
    WifiOff,
} from 'lucide-react';

/**
 * The bot's connection, as the agent reports it.
 *
 * The agent has had a `/whatsapp/status` endpoint returning the pairing QR as
 * a data URL all along; this page simply never asked, and told people to go
 * and read the server's terminal instead — which is impossible on a hosted
 * deployment where nobody has a terminal.
 */
type Status = 'disconnected' | 'connecting' | 'qr' | 'ready' | 'error';

interface AgentStatus {
    status: Status;
    connected: boolean;
    phoneNumber: string | null;
    qrCode: string | null;
    messagesSent: number;
    queuedMessages: number;
    lastError: string | null;
    /** When the pairing was last copied to Postgres; null means disk-only. */
    sessionBackedUpAt: string | null;
}

const AGENT_BASE_URL =
    process.env.NEXT_PUBLIC_AGENT_URL || 'http://localhost:3001';

/** Fast while a QR is on screen (they expire), slow once connected. */
const POLL_PAIRING_MS = 4000;
const POLL_IDLE_MS = 20000;

export function WhatsAppIntegration({ organizationId }: { organizationId: string }) {
    const [agent, setAgent] = useState<AgentStatus | null>(null);
    const [reachable, setReachable] = useState<boolean | null>(null);
    const [checking, setChecking] = useState(false);

    const refresh = useCallback(async () => {
        setChecking(true);
        try {
            const response = await fetch(
                `${AGENT_BASE_URL}/whatsapp/status?organizationId=${encodeURIComponent(organizationId)}`,
                { cache: 'no-store' },
            );
            if (!response.ok) throw new Error(`Agent returned ${response.status}`);

            const data = (await response.json()) as AgentStatus & { success: boolean };
            setAgent(data);
            setReachable(true);
        } catch {
            // The agent being down is the common case in development and a
            // real one in production; it is reported, not thrown.
            setReachable(false);
            setAgent(null);
        } finally {
            setChecking(false);
        }
    }, [organizationId]);

    useEffect(() => {
        void refresh();
    }, [refresh]);

    // Poll faster while a code is waiting to be scanned — WhatsApp expires
    // them after about twenty seconds, so a stale image is worse than none.
    useEffect(() => {
        const pairing = agent?.status === 'qr' || agent?.status === 'connecting';
        const interval = setInterval(
            () => void refresh(),
            pairing ? POLL_PAIRING_MS : POLL_IDLE_MS,
        );
        return () => clearInterval(interval);
    }, [agent?.status, refresh]);

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div>
                    <CardTitle>Connection</CardTitle>
                    <CardDescription>
                        The phone this system sends and receives WhatsApp messages from.
                    </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                    <ConnectionBadge reachable={reachable} status={agent?.status} />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refresh()}
                        disabled={checking}
                    >
                        {checking ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <RefreshCw className="h-4 w-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">Refresh</span>
                    </Button>
                </div>
            </CardHeader>

            <CardContent className="space-y-4">
                {reachable === false && (
                    <Alert variant="destructive">
                        <WifiOff className="h-4 w-4" />
                        <AlertTitle>Can&apos;t reach the assistant service</AlertTitle>
                        <AlertDescription>
                            Nothing at <code>{AGENT_BASE_URL}</code>. Either it isn&apos;t
                            running, or <code>NEXT_PUBLIC_AGENT_URL</code> points somewhere
                            else. Messages will not be sent or answered until it is back.
                        </AlertDescription>
                    </Alert>
                )}

                {agent?.status === 'ready' && (
                    <div className="rounded-lg border bg-muted/40 p-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Paired
                            {agent.phoneNumber && (
                                <span className="font-mono text-muted-foreground">
                                    +{agent.phoneNumber.replace(/\D/g, '')}
                                </span>
                            )}
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                            {agent.messagesSent} message
                            {agent.messagesSent === 1 ? '' : 's'} sent
                            {agent.queuedMessages > 0 &&
                                `, ${agent.queuedMessages} waiting to go out`}
                            . Keep the phone online — WhatsApp Web stops working when
                            the paired phone is off for too long.
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {agent.sessionBackedUpAt ? (
                                <>
                                    Pairing saved to the database{' '}
                                    {new Date(agent.sessionBackedUpAt).toLocaleString('en-GB')} — it
                                    will survive a redeploy.
                                </>
                            ) : (
                                <span className="text-amber-600">
                                    The pairing is only on the server&apos;s disk. It will be
                                    lost on the next redeploy and this code will have to be
                                    scanned again. Set <code>DATABASE_URL</code> on the agent.
                                </span>
                            )}
                        </p>
                    </div>
                )}

                {agent?.qrCode && agent.status !== 'ready' && (
                    <div className="flex flex-col items-center gap-3 rounded-lg border p-6">
                        <p className="text-sm font-medium">Scan to pair this phone</p>
                        {/* The agent hands this over as a data URL, so it renders
                            without the image ever leaving the browser. */}
                        <Image
                            src={agent.qrCode}
                            alt="WhatsApp pairing QR code"
                            width={240}
                            height={240}
                            unoptimized
                            className="rounded bg-white p-2"
                        />
                        <ol className="mt-1 max-w-sm list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
                            <li>Open WhatsApp on the phone the business uses.</li>
                            <li>Settings, then Linked devices, then Link a device.</li>
                            <li>Point it at this code.</li>
                        </ol>
                        <p className="text-xs text-muted-foreground">
                            The code refreshes itself every few seconds — scan whichever
                            one is on screen.
                        </p>
                    </div>
                )}

                {reachable && !agent?.qrCode && agent?.status !== 'ready' && (
                    <Alert>
                        <Smartphone className="h-4 w-4" />
                        <AlertTitle>No pairing code yet</AlertTitle>
                        <AlertDescription>
                            The service is running but the WhatsApp client hasn&apos;t
                            produced a code. It is usually off:{' '}
                            <code>ENABLE_WHATSAPP</code> must be <code>&quot;true&quot;</code>{' '}
                            on the agent for the bot to start at all.
                        </AlertDescription>
                    </Alert>
                )}

                {agent?.lastError && (
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Last error</AlertTitle>
                        <AlertDescription>{agent.lastError}</AlertDescription>
                    </Alert>
                )}
            </CardContent>
        </Card>
    );
}

function ConnectionBadge({
    reachable,
    status,
}: {
    reachable: boolean | null;
    status?: Status;
}) {
    if (reachable === null) return <Badge variant="outline">Checking…</Badge>;
    if (reachable === false) return <Badge variant="destructive">Service down</Badge>;

    switch (status) {
        case 'ready':
            return <Badge className="bg-green-600 hover:bg-green-600">Connected</Badge>;
        case 'qr':
            return <Badge variant="secondary">Waiting for scan</Badge>;
        case 'connecting':
            return <Badge variant="secondary">Connecting…</Badge>;
        case 'error':
            return <Badge variant="destructive">Error</Badge>;
        default:
            return <Badge variant="outline">Not connected</Badge>;
    }
}
