"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, Mail, Loader2, Check, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { notifyDriverByWhatsApp, notifyDriverByEmail } from "../actions";

interface NotifyDriverButtonProps {
    tripId: string;
    driverName: string;
    driverPhone: string | null;
    driverEmail: string | null;
    alreadyNotified: boolean;
}

export function NotifyDriverButton({
    tripId,
    driverName,
    driverPhone,
    driverEmail,
    alreadyNotified,
}: NotifyDriverButtonProps) {
    const [loading, setLoading] = useState(false);
    const [notified, setNotified] = useState(alreadyNotified);

    const handleNotifyWhatsApp = async () => {
        if (!driverPhone) {
            toast.error("Driver has no WhatsApp number configured");
            return;
        }

        setLoading(true);
        try {
            const result = await notifyDriverByWhatsApp(tripId);

            if (result.success) {
                setNotified(true);
                toast.success(`WhatsApp notification sent to ${driverName}`);
            } else {
                toast.error("Failed to send WhatsApp notification", {
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

    const handleNotifyEmail = async () => {
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
                toast.error("Failed to send email notification", {
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

    const hasNoContact = !driverPhone && !driverEmail;

    if (hasNoContact) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" disabled>
                            <AlertCircle className="h-4 w-4 mr-2" />
                            No Contact Info
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Driver has no phone or email configured</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (notified) {
        return (
            <div className="flex gap-2">
                {driverPhone && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="text-green-600"
                                    onClick={handleNotifyWhatsApp}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Check className="h-4 w-4 mr-2" />
                                    )}
                                    Resend WhatsApp
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Click to send another WhatsApp notification</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                {driverEmail && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleNotifyEmail}
                                    disabled={loading}
                                >
                                    {loading ? (
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                        <Mail className="h-4 w-4 mr-2" />
                                    )}
                                    Email
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>Click to send email notification</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
        );
    }

    return (
        <div className="flex gap-2">
            {driverPhone && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNotifyWhatsApp}
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <MessageCircle className="h-4 w-4 mr-2" />
                    )}
                    WhatsApp
                </Button>
            )}
            {driverEmail && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNotifyEmail}
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                        <Mail className="h-4 w-4 mr-2" />
                    )}
                    Email
                </Button>
            )}
        </div>
    );
}
