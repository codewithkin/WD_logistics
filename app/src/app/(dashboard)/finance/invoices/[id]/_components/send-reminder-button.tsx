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
import { sendInvoiceReminderByEmail } from "../actions";

interface SendReminderButtonProps {
    invoiceId: string;
    customerName: string;
    customerEmail: string | null;
    alreadySent: boolean;
    balance: number;
}

export function SendReminderButton({
    invoiceId,
    customerName,
    customerEmail,
    alreadySent,
    balance,
}: SendReminderButtonProps) {
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(alreadySent);

    const handleSendReminder = async () => {
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
                toast.error("Failed to send reminder", {
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

    if (!customerEmail) {
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
                        <p>Customer has no email address configured</p>
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
        <Button
            variant="outline"
            size="sm"
            onClick={handleSendReminder}
            disabled={loading}
        >
            {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : sent ? (
                <Check className="h-4 w-4 mr-2 text-green-600" />
            ) : (
                <Mail className="h-4 w-4 mr-2" />
            )}
            {sent ? "Send Again" : "Send Reminder"}
        </Button>
    );
}
