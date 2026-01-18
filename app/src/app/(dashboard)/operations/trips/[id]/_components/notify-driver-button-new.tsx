"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { notifyDriverByEmail } from "../actions";

interface NotifyDriverButtonProps {
    tripId: string;
    driverName: string;
    driverEmail: string | null;
    alreadyNotified: boolean;
}

export function NotifyDriverButton({
    tripId,
    driverName,
    driverEmail,
    alreadyNotified,
}: NotifyDriverButtonProps) {
    const [loading, setLoading] = useState(false);
    const [notified, setNotified] = useState(alreadyNotified);

    const handleNotify = async () => {
        if (!driverEmail) {
            toast.error("Driver has no email address configured");
            return;
        }

        setLoading(true);
        try {
            const result = await notifyDriverByEmail(tripId);

            if (result.success) {
                setNotified(true);
                toast.success(`Email notification sent to ${driverName}`);
            } else {
                toast.error("Failed to send notification", {
                    description: result.error,
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

    if (!driverEmail) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" disabled>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            No Email
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Driver has no email address configured</p>
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
                <Mail className="h-4 w-4 mr-2" />
            )}
            Notify Driver
        </Button>
    );
}
