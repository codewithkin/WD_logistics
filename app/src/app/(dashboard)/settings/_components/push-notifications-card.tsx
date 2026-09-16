"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications } from "@/lib/use-push-notifications";
import { toast } from "sonner";
import { useState } from "react";

/**
 * Opt-in for native browser push notifications — separate from (and in
 * addition to) WhatsApp and in-app notifications. See
 * src/lib/notification-tiers.ts for which notification types actually use
 * this channel.
 */
export function PushNotificationsCard() {
    const { status, isLoading, subscribe, unsubscribe } = usePushNotifications();
    const [isToggling, setIsToggling] = useState(false);

    const handleEnable = async () => {
        setIsToggling(true);
        try {
            await subscribe();
            toast.success("Push notifications enabled on this device");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Failed to enable push notifications");
        } finally {
            setIsToggling(false);
        }
    };

    const handleDisable = async () => {
        setIsToggling(true);
        try {
            await unsubscribe();
            toast.success("Push notifications disabled on this device");
        } catch {
            toast.error("Failed to disable push notifications");
        } finally {
            setIsToggling(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BellRing className="h-5 w-5" />
                    Push Notifications
                </CardTitle>
                <CardDescription>
                    Get real-time alerts on this device, even when WD Logistics isn&apos;t open in a tab.
                    This is separate from WhatsApp and in-app notifications.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Checking status...
                    </div>
                ) : status === "unsupported" ? (
                    <p className="text-sm text-muted-foreground">
                        Your browser doesn&apos;t support push notifications.
                    </p>
                ) : status === "denied" ? (
                    <p className="text-sm text-muted-foreground">
                        Notifications are blocked for this site in your browser settings. Enable them there to use this feature.
                    </p>
                ) : status === "subscribed" ? (
                    <div className="flex items-center justify-between">
                        <Badge variant="outline" className="gap-1.5">
                            <Bell className="h-3 w-3" />
                            Enabled on this device
                        </Badge>
                        <Button variant="outline" size="sm" onClick={handleDisable} disabled={isToggling}>
                            {isToggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellOff className="mr-2 h-4 w-4" />}
                            Disable
                        </Button>
                    </div>
                ) : (
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Not enabled on this device yet.</p>
                        <Button size="sm" onClick={handleEnable} disabled={isToggling}>
                            {isToggling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Bell className="mr-2 h-4 w-4" />}
                            Enable
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
