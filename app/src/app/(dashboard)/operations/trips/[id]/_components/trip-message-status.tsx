"use client";

/**
 * "Was the driver actually told?" — answered on the trip page.
 *
 * The client's words: so that a driver cannot turn up saying "WhatsApp
 * message? What WhatsApp message?". Every attempt is listed with which number
 * it went to and how far it got, and a failure says why and offers a resend
 * rather than leaving a silent tick.
 */

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle,
  Check,
  CheckCheck,
  Clock,
  Loader2,
  MessageSquare,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { resendTripMessage } from "../actions";

export interface TripMessageRow {
  id: string;
  status: string;
  recipientPhone: string;
  recipientName: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  error: string | null;
  createdAt: Date;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "Sending…",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "read":
      return <CheckCheck className="h-4 w-4 text-emerald-600" />;
    case "delivered":
      return <CheckCheck className="h-4 w-4 text-muted-foreground" />;
    case "sent":
      return <Check className="h-4 w-4 text-muted-foreground" />;
    case "failed":
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
}

export function TripMessageStatus({
  tripId,
  messages,
  driverName,
  driverHasNumber,
  canResend,
}: {
  tripId: string;
  messages: TripMessageRow[];
  driverName: string;
  /** False when the driver has neither a WhatsApp number nor a phone. */
  driverHasNumber: boolean;
  canResend: boolean;
}) {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);

  const latest = messages[0];

  const handleResend = async () => {
    setIsSending(true);
    try {
      const result = await resendTripMessage(tripId);
      if (result.success) {
        toast.success(`Message sent to ${driverName}.`);
      } else {
        toast.error(result.error ?? "The message could not be sent.");
      }
      router.refresh();
    } catch {
      toast.error("The message could not be sent.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="mt-6">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" /> Driver notification
        </CardTitle>
        {canResend && driverHasNumber && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResend}
            disabled={isSending}
          >
            {isSending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {messages.length === 0 ? "Send" : "Resend"}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {!driverHasNumber ? (
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <span>
              {driverName} has no WhatsApp number or phone number on record, so
              nothing can be sent. Add one on their driver page.
            </span>
          </p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has been sent to {driverName} about this trip yet.
          </p>
        ) : (
          <div className="space-y-3">
            {/* The headline: what happened to the most recent attempt. */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusIcon status={latest.status} />
              <span className="text-sm font-medium">
                {STATUS_LABEL[latest.status] ?? latest.status}
              </span>
              <span className="text-sm text-muted-foreground">
                to {latest.recipientName ?? driverName} ({latest.recipientPhone})
              </span>
              {latest.readAt ? (
                <Badge variant="outline" className="text-[10px]">
                  read {format(latest.readAt, "HH:mm")}
                </Badge>
              ) : latest.deliveredAt ? (
                <Badge variant="outline" className="text-[10px]">
                  delivered {format(latest.deliveredAt, "HH:mm")}
                </Badge>
              ) : latest.sentAt ? (
                <Badge variant="outline" className="text-[10px]">
                  sent {format(latest.sentAt, "HH:mm")}
                </Badge>
              ) : null}
            </div>

            {latest.status === "failed" && latest.error && (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                {latest.error}
              </p>
            )}

            {/* Earlier attempts, so a resend doesn't hide the first failure. */}
            {messages.length > 1 && (
              <div className="space-y-1 border-t pt-2">
                <p className="text-xs text-muted-foreground">
                  Earlier attempts
                </p>
                {messages.slice(1).map((message) => (
                  <div
                    key={message.id}
                    className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                  >
                    <StatusIcon status={message.status} />
                    <span>{STATUS_LABEL[message.status] ?? message.status}</span>
                    <span>·</span>
                    <span>{format(message.createdAt, "d MMM yyyy, HH:mm")}</span>
                    {message.error && <span>· {message.error}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
