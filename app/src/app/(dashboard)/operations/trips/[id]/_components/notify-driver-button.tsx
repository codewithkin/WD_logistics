"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare, Loader2, Check, AlertCircle } from "lucide-react";
import { notifyTripAssignment } from "@/lib/whatsapp/notifications";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface NotifyDriverButtonProps {
    tripId: string;
    driverName: string;
    driverPhone: string | null;
    alreadyNotified: boolean;
}

export function NotifyDriverButton({
    tripId,
    driverName,
    driverPhone,
    alreadyNotified,
}: NotifyDriverButtonProps) {
    const [loading, setLoading] = useState(false);
    const [notified, setNotified] = useState(alreadyNotified);

    const handleNotify = async () => {
        if (!driverPhone) {
            toast.error("Driver has no phone number configured");
            return;
        }

        setLoading(true);
        try {
            const result = await notifyTripAssignment(tripId, true);

            if (result.success) {
                setNotified(true);
                if (result.whatsappSent) {
                    toast.success(`Notification sent to ${driverName} via WhatsApp`);
                } else {
                    toast.success(`Notification queued for ${driverName}`, {
                        description: result.whatsappError || "WhatsApp not connected",
                    });
                }
            } else {
                toast.error("Failed to send notification", {
                    description: result.error || result.message,
                });
            }
        } catch (error) {
            toast.error("Failed to send notification", {
                description: error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setLoading(false);
        }
    };

    if (!driverPhone) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" disabled>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            No Phone
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Driver has no phone number configured</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (notified) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" className="text-green-600" onClick={handleNotify} disabled={loading}>
                            {loading ? (
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                                <Check className="h-4 w-4 mr-2" />
                            )}
                            Notified
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Click to send another notification</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            onClick={handleNotify}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
                <MessageSquare className="h-4 w-4 mr-2" />
            )}
            Notify Driver
        </Button>
    );
}
