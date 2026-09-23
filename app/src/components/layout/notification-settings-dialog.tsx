"use client";

/**
 * "Notifications" in the user menu — available to every role.
 *
 * The Enable button used to live under Settings, which is admin-only, so
 * supervisors, staff and workshop users could not turn push on at all even
 * though most of the events that push are aimed at them. That, plus silent
 * delivery failures, is most of what "push notifications are not working"
 * meant. This dialog lets anyone enable push on their own device, prove it
 * with a test, see why the last few attempts succeeded or failed, and mute
 * the categories they don't want.
 */

import { useEffect, useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellOff,
  CheckCircle2,
  Loader2,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePushNotifications } from "@/lib/use-push-notifications";
import {
  getNotificationSettings,
  setNotificationPreference,
  type DeliveryRow,
  type NotificationCategory,
} from "@/app/(dashboard)/_actions/notification-settings";

export function NotificationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { status, isLoading, configError, subscribe, unsubscribe } =
    usePushNotifications();
  const [isToggling, setIsToggling] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [categories, setCategories] = useState<NotificationCategory[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [, startTransition] = useTransition();

  const loadSettings = () => {
    setLoadingSettings(true);
    getNotificationSettings()
      .then((data) => {
        setCategories(data.categories);
        setDeliveries(data.recentDeliveries);
      })
      .catch(() => {
        // The dialog still works for enabling push if this fails.
      })
      .finally(() => setLoadingSettings(false));
  };

  useEffect(() => {
    if (open) loadSettings();
  }, [open]);

  const handleEnable = async () => {
    setIsToggling(true);
    try {
      await subscribe();
      toast.success("Notifications enabled on this device");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not enable notifications",
      );
    } finally {
      setIsToggling(false);
    }
  };

  const handleDisable = async () => {
    setIsToggling(true);
    try {
      await unsubscribe();
      toast.success("Notifications disabled on this device");
    } catch {
      toast.error("Could not disable notifications");
    } finally {
      setIsToggling(false);
    }
  };

  const handleTest = async () => {
    setIsTesting(true);
    try {
      const response = await fetch("/api/push/test", { method: "POST" });
      const result = await response.json();
      if (result.success) {
        toast.success(
          `Test sent to ${result.sent} device${result.sent === 1 ? "" : "s"}. It should arrive within a few seconds.`,
        );
      } else {
        toast.error(result.error ?? "The test notification could not be sent.");
      }
      loadSettings();
    } catch {
      toast.error("Could not reach the server to send a test.");
    } finally {
      setIsTesting(false);
    }
  };

  const toggleCategory = (key: string, pushEnabled: boolean) => {
    setCategories((prev) =>
      prev.map((c) => (c.key === key ? { ...c, pushEnabled } : c)),
    );
    startTransition(async () => {
      try {
        await setNotificationPreference(key, pushEnabled);
      } catch {
        toast.error("Could not save that preference.");
        setCategories((prev) =>
          prev.map((c) => (c.key === key ? { ...c, pushEnabled: !pushEnabled } : c)),
        );
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4" /> Notifications
          </DialogTitle>
          <DialogDescription className="text-xs">
            Alerts on this device, even when WD Logistics isn&apos;t open.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* ---- this device ---- */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">This device</h3>

            {configError ? (
              <p className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {configError}
              </p>
            ) : null}

            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking…
              </div>
            ) : status === "needs-install" ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <p className="flex items-center gap-2 font-medium">
                  <Smartphone className="h-4 w-4" /> Add WD Logistics to your Home
                  Screen first
                </p>
                <p className="mt-1 text-muted-foreground">
                  iPhone and iPad only deliver notifications to an installed app.
                  Tap Share, then &ldquo;Add to Home Screen&rdquo;, and open
                  WD Logistics from the icon — this button will work there.
                </p>
              </div>
            ) : status === "unsupported" ? (
              <p className="text-sm text-muted-foreground">
                This browser doesn&apos;t support notifications.
              </p>
            ) : status === "denied" ? (
              <p className="text-sm text-muted-foreground">
                Notifications are blocked for this site in your browser settings.
                Allow them there, then reopen this dialog.
              </p>
            ) : status === "subscribed" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Badge variant="outline" className="gap-1.5">
                  <Bell className="h-3 w-3" /> Enabled
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    disabled={isTesting}
                  >
                    {isTesting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="mr-2 h-4 w-4" />
                    )}
                    Send test
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDisable}
                    disabled={isToggling}
                  >
                    {isToggling ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <BellOff className="mr-2 h-4 w-4" />
                    )}
                    Turn off
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">Not enabled yet.</p>
                <Button size="sm" onClick={handleEnable} disabled={isToggling}>
                  {isToggling ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Bell className="mr-2 h-4 w-4" />
                  )}
                  Enable
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              You are never notified about your own actions — use Send test to
              check this device.
            </p>
          </section>

          <Separator />

          {/* ---- what to send ---- */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">What to send me</h3>
            {loadingSettings ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : categories.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to configure for your role yet.
              </p>
            ) : (
              <div className="space-y-3">
                {categories.map((category) => (
                  <div
                    key={category.key}
                    className="flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{category.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {category.description}
                      </p>
                    </div>
                    <Switch
                      checked={category.pushEnabled}
                      onCheckedChange={(checked) =>
                        toggleCategory(category.key, checked)
                      }
                      aria-label={category.label}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>

          <Separator />

          {/* ---- delivery history ---- */}
          <section className="space-y-3">
            <h3 className="text-sm font-medium">Recent attempts</h3>
            {deliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing has been sent to you yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {deliveries.map((delivery) => (
                  <li key={delivery.id} className="flex items-start gap-2 text-sm">
                    {delivery.status === "sent" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-medium">{delivery.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(delivery.createdAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {delivery.status !== "sent" && delivery.error
                          ? ` — ${delivery.error}`
                          : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
