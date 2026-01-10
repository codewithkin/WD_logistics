"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  MessageCircle,
  Loader2,
  RefreshCcw,
  Power,
  AlertTriangle,
  CheckCircle2,
  QrCode,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppState {
  status: "disconnected" | "connecting" | "qr_ready" | "authenticated" | "ready" | "auth_failure";
  qrCode: string | null;
  phoneNumber: string | null;
  lastError: string | null;
}

export function WhatsAppStatus() {
  const [state, setState] = useState<WhatsAppState>({
    status: "disconnected",
    qrCode: null,
    phoneNumber: null,
    lastError: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);

  // Fetch initial status
  useEffect(() => {
    fetchStatus();
    // Poll status every 5 seconds
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/whatsapp/status");
      const data = await response.json();
      if (data.success) {
        setState(data);
        // Show QR dialog when QR is ready
        if (data.status === "qr_ready" && data.qrCode) {
          setShowQRDialog(true);
        }
      }
    } catch (error) {
      console.error("Failed to fetch status:", error);
    }
  }, []);

  const handleInitialize = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/whatsapp/initialize", {
        method: "POST",
      });
      const data = await response.json();
      if (data.success) {
        setState((prev) => ({ ...prev, status: "connecting" }));
        setShowQRDialog(true);
      }
    } catch (error) {
      console.error("Failed to initialize:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/whatsapp/initialize", {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setState({
          status: "disconnected",
          qrCode: null,
          phoneNumber: null,
          lastError: null,
        });
      }
    } catch (error) {
      console.error("Failed to disconnect:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-500 hover:bg-green-500";
      case "qr_ready":
      case "connecting":
      case "authenticated":
        return "bg-blue-500 hover:bg-blue-500";
      case "auth_failure":
        return "bg-red-500 hover:bg-red-500";
      default:
        return "bg-gray-500 hover:bg-gray-500";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "disconnected":
        return "Disconnected";
      case "connecting":
        return "Connecting...";
      case "qr_ready":
        return "Scan QR Code";
      case "authenticated":
        return "Authenticated";
      case "ready":
        return "Connected";
      case "auth_failure":
        return "Auth Failed";
      default:
        return "Unknown";
    }
  };

  const isConnected = state.status === "ready";
  const isConnecting =
    state.status === "connecting" || state.status === "qr_ready" || state.status === "authenticated";

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
                <MessageCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <CardTitle>WhatsApp Integration</CardTitle>
                <CardDescription>Connect WhatsApp for driver and customer notifications</CardDescription>
              </div>
            </div>
            <Badge variant={isConnected ? "default" : "secondary"} className={getStatusColor(state.status)}>
              {getStatusLabel(state.status)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Status Info */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Connection Status</h4>
            <div className="rounded-lg bg-muted p-3">
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium">{getStatusLabel(state.status)}</span>
                </div>
                {state.phoneNumber && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{state.phoneNumber}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {state.lastError && state.status === "auth_failure" && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{state.lastError}</AlertDescription>
            </Alert>
          )}

          {/* Success Alert */}
          {isConnected && (
            <Alert className="border-green-500/50 bg-green-50 text-green-900 dark:bg-green-950 dark:text-green-100">
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>WhatsApp is connected and ready to send notifications</AlertDescription>
            </Alert>
          )}

          {/* Instructions */}
          {state.status === "qr_ready" && state.qrCode && (
            <Alert className="border-blue-500/50 bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100">
              <QrCode className="h-4 w-4" />
              <AlertDescription>
                Open WhatsApp on your phone and scan the QR code using the linked devices feature
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {!isConnected && !isConnecting && (
              <Button onClick={handleInitialize} disabled={isLoading} className="gap-2">
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Power className="h-4 w-4" />
                )}
                Connect WhatsApp
              </Button>
            )}

            {isConnecting && (
              <Button disabled className="gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for Authentication...
              </Button>
            )}

            {isConnected && (
              <>
                <Button variant="outline" onClick={fetchStatus} disabled={isLoading} className="gap-2">
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-4 w-4" />
                  )}
                  Refresh
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDisconnect}
                  disabled={isLoading}
                  className="gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Power className="h-4 w-4" />
                  )}
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {/* Features List */}
          <div className="space-y-2 border-t pt-4">
            <h4 className="text-sm font-medium">Features</h4>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500" : "bg-gray-300")}
                />
                Trip assignments to drivers
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500" : "bg-gray-300")}
                />
                Invoice reminders to customers
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500" : "bg-gray-300")}
                />
                Payment confirmations
              </li>
              <li className="flex items-center gap-2">
                <span
                  className={cn("h-2 w-2 rounded-full", isConnected ? "bg-green-500" : "bg-gray-300")}
                />
                Driver availability alerts
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* QR Code Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>WhatsApp Authentication</DialogTitle>
            <DialogDescription>
              Scan this QR code with WhatsApp on your phone to authenticate
            </DialogDescription>
          </DialogHeader>

          {state.qrCode && (
            <div className="flex justify-center">
              <img src={state.qrCode} alt="WhatsApp QR Code" className="h-64 w-64 rounded-lg border" />
            </div>
          )}

          <div className="text-center text-sm text-muted-foreground">
            <ol className="space-y-1 text-left">
              <li>1. Open WhatsApp on your phone</li>
              <li>2. Go to Settings → Linked Devices</li>
              <li>3. Tap "Link a Device"</li>
              <li>4. Point your phone camera at the QR code</li>
              <li>5. Wait for confirmation on this screen</li>
            </ol>
          </div>

          <Button
            variant="outline"
            onClick={() => setShowQRDialog(false)}
            className="w-full"
          >
            Close
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
