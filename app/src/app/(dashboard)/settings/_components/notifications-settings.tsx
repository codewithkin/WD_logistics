import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { PushDeliveryLog } from "./push-delivery-log";

/**
 * The organisation-wide notification view.
 *
 * This card used to offer five switches — email notifications, trip updates,
 * invoice reminders, maintenance alerts, driver licence expiry — with a Save
 * button that waited half a second and said "Notification preferences saved".
 * Nothing was saved. The toggles were fed hardcoded defaults, the handler had
 * a TODO where the write should have been, and reloading the page put them
 * all back. A control that claims to have worked is worse than no control.
 *
 * It was also a second copy of something that already works. Muting is per
 * person and per device, so it lives in the user menu — where every role can
 * reach it, which was the point of moving it there — and the switches there
 * write to `NotificationPreference` and are honoured by `lib/push.ts`. One of
 * the two had to go, and it was the one that did nothing.
 *
 * Email was never a channel for staff notifications either (see the note at
 * the top of `lib/notification-tiers.ts`): the emails this system sends are
 * invoices, reminders and receipts to customers, which are documents rather
 * than notifications and are not switchable here.
 *
 * What genuinely belongs in Settings is the admin's view across everybody:
 * who is subscribed, what went out, and why anything failed.
 */
export function NotificationsSettings() {
  return (
    <div className="space-y-6">
      <PushDeliveryLog />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Choosing what you are told about
          </CardTitle>
          <CardDescription>
            Per person, not per organisation — so it is in your own menu rather
            than here.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Open the menu under your name, top right, and choose{" "}
            <span className="font-medium text-foreground">Notifications</span>.
            You can turn any category off there, and it takes effect for you on
            every device.
          </p>
          <p>
            Anything urgent — an account short of funds, a document already
            expired, a driver&apos;s message that failed to send — cannot be
            turned off. Those are the ones worth interrupting somebody for.
          </p>
          <p>
            The emails this system sends to customers are invoices, reminders
            and receipts. They are documents rather than notifications, and are
            not affected by any of these switches.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
