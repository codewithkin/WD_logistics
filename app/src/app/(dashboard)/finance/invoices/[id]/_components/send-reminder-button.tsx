"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Loader2, Check, AlertCircle } from "lucide-react";
import { sendInvoiceReminder } from "@/lib/whatsapp/notifications";
import { toast } from "sonner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface SendReminderButtonProps {
  invoiceId: string;
  customerName: string;
  customerPhone: string | null;
  alreadySent: boolean;
  balance: number;
}

export function SendReminderButton({
  invoiceId,
  customerName,
  customerPhone,
  alreadySent,
  balance,
}: SendReminderButtonProps) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(alreadySent);

  const handleSendReminder = async () => {
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
      const result = await sendInvoiceReminder(invoiceId, true);

      if (result.success) {
        setSent(true);
        if (result.whatsappSent) {
          toast.success(`Reminder sent to ${customerName} via WhatsApp`);
        } else {
          toast.success(`Reminder queued for ${customerName}`, {
            description: result.whatsappError || "WhatsApp not connected",
          });
        }
      } else {
        toast.error("Failed to send reminder", {
          description: result.error || result.message,
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

  if (!customerPhone) {
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
            <p>Customer has no phone number configured</p>
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
        <Bell className="h-4 w-4 mr-2" />
      )}
      {sent ? "Send Again" : "Send Reminder"}
    </Button>
  );
}
