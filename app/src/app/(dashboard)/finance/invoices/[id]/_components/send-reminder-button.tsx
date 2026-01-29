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
import { sendInvoiceReminderByWhatsApp, sendInvoiceReminderByEmail } from "../actions";

interface SendReminderButtonProps {
    invoiceId: string;
    customerName: string;
    customerPhone: string | null;
    customerEmail: string | null;
    alreadySent: boolean;
    balance: number;
}

export function SendReminderButton({
    invoiceId,
    customerName,
    customerPhone,
    customerEmail,
    alreadySent,
    balance,
}: SendReminderButtonProps) {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(alreadySent);

    const handleSendWhatsApp = async () => {
        if (!customerPhone) {
            toast.error("Customer has no phone number configured");
            return;
        }

        if (balance <= 0) {
            toast.info("Invoice has no outstanding balance");
            return;
        }

        setLoading(true);
        try {
            const result = await sendInvoiceReminderByWhatsApp(invoiceId);

            if (result.success) {
                setSent(true);
                toast.success(`WhatsApp reminder sent to ${customerName}`);
            } else {
                toast.error("Failed to send WhatsApp reminder", {
                    description: result.error,
                });
            }
        } catch (error) {
            toast.error("Failed to send reminder", {
                description: error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSendEmail = async () => {
        if (!customerEmail) {
            toast.error("Customer has no email address configured");
            return;
        }

        if (balance <= 0) {
            toast.info("Invoice has no outstanding balance");
            return;
        }

        setLoading(true);
        try {
            const result = await sendInvoiceReminderByEmail(invoiceId);

            if (result.success) {
                setSent(true);
                toast.success(`Email reminder sent to ${customerName}`);
            } else {
                toast.error("Failed to send email reminder", {
                    description: result.error,
                });
            }
        } catch (error) {
            toast.error("Failed to send reminder", {
                description: error instanceof Error ? error.message : "Unknown error",
            });
        } finally {
            setLoading(false);
        }
    };

    const hasNoContact = !customerPhone && !customerEmail;

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
                        <p>Customer has no phone or email configured</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    if (balance <= 0) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button variant="outline" size="sm" disabled className="text-green-600">
                            <Check className="h-4 w-4 mr-2" />
                            Paid
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Invoice has been paid in full</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    }

    return (
        <div className="flex gap-2">
            {customerPhone && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendWhatsApp}
                    disabled={loading}
                >
                    {loading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : sent ? (
                        <Check className="h-4 w-4 mr-2 text-green-600" />
                    ) : (
                        <MessageCircle className="h-4 w-4 mr-2" />
                    )}
                    {sent ? "Resend WhatsApp" : "WhatsApp"}
                </Button>
            )}
            {customerEmail && (
                <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSendEmail}
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
