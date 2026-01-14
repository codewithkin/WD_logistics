"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NotificationPreferences {
    emailNotifications: boolean;
    tripUpdates: boolean;
    invoiceReminders: boolean;
    maintenanceAlerts: boolean;
    driverLicenseExpiry: boolean;
}

interface NotificationsSettingsProps {
    preferences: NotificationPreferences;
}

export function NotificationsSettings({ preferences: initialPreferences }: NotificationsSettingsProps) {
    const [isLoading, setIsLoading] = useState(false);
    const [preferences, setPreferences] = useState<NotificationPreferences>(initialPreferences);

    const handleToggle = (key: keyof NotificationPreferences) => {
        setPreferences((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = async () => {
        setIsLoading(true);
        try {
            // TODO: Save to backend when API is ready
            await new Promise((resolve) => setTimeout(resolve, 500));
            toast.success("Notification preferences saved");
        } catch {
            toast.error("Failed to save preferences");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Email Notifications</CardTitle>
                    <CardDescription>
                        Choose which email notifications you would like to receive.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="email-notifications">Email Notifications</Label>
                            <p className="text-sm text-muted-foreground">
                                Receive email notifications for important updates.
                            </p>
                        </div>
                        <Switch
                            id="email-notifications"
                            checked={preferences.emailNotifications}
                            onCheckedChange={() => handleToggle("emailNotifications")}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="trip-updates">Trip Updates</Label>
                            <p className="text-sm text-muted-foreground">
                                Get notified when trip status changes.
                            </p>
                        </div>
                        <Switch
                            id="trip-updates"
                            checked={preferences.tripUpdates}
                            onCheckedChange={() => handleToggle("tripUpdates")}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="invoice-reminders">Invoice Reminders</Label>
                            <p className="text-sm text-muted-foreground">
                                Receive reminders for overdue invoices.
                            </p>
                        </div>
                        <Switch
                            id="invoice-reminders"
                            checked={preferences.invoiceReminders}
                            onCheckedChange={() => handleToggle("invoiceReminders")}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="maintenance-alerts">Maintenance Alerts</Label>
                            <p className="text-sm text-muted-foreground">
                                Get alerts for scheduled vehicle maintenance.
                            </p>
                        </div>
                        <Switch
                            id="maintenance-alerts"
                            checked={preferences.maintenanceAlerts}
                            onCheckedChange={() => handleToggle("maintenanceAlerts")}
                        />
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                            <Label htmlFor="license-expiry">Driver License Expiry</Label>
                            <p className="text-sm text-muted-foreground">
                                Receive alerts before driver licenses expire.
                            </p>
                        </div>
                        <Switch
                            id="license-expiry"
                            checked={preferences.driverLicenseExpiry}
                            onCheckedChange={() => handleToggle("driverLicenseExpiry")}
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save Preferences
                </Button>
            </div>
        </div>
    );
}
