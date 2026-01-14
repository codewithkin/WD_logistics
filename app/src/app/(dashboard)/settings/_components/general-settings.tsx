"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { updateOrganizationSettings } from "../actions";
import { toast } from "sonner";

const generalSettingsSchema = z.object({
    currency: z.string(),
    timezone: z.string(),
});

type GeneralSettingsData = z.infer<typeof generalSettingsSchema>;

interface GeneralSettingsProps {
    settings: {
        currency: string;
        timezone: string;
    };
    organizationName: string;
}

const CURRENCIES = [
    { value: "USD", label: "US Dollar ($)" },
    { value: "EUR", label: "Euro (€)" },
    { value: "GBP", label: "British Pound (£)" },
    { value: "KES", label: "Kenyan Shilling (KSh)" },
    { value: "NGN", label: "Nigerian Naira (₦)" },
    { value: "ZAR", label: "South African Rand (R)" },
];

const TIMEZONES = [
    { value: "UTC", label: "UTC" },
    { value: "Africa/Nairobi", label: "East Africa Time (EAT)" },
    { value: "Africa/Lagos", label: "West Africa Time (WAT)" },
    { value: "Africa/Johannesburg", label: "South Africa Standard Time (SAST)" },
    { value: "America/New_York", label: "Eastern Time (ET)" },
    { value: "America/Los_Angeles", label: "Pacific Time (PT)" },
    { value: "Europe/London", label: "Greenwich Mean Time (GMT)" },
];

export function GeneralSettings({ settings, organizationName }: GeneralSettingsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<GeneralSettingsData>({
        resolver: zodResolver(generalSettingsSchema),
        defaultValues: {
            currency: settings.currency,
            timezone: settings.timezone,
        },
    });

    const onSubmit = async (data: GeneralSettingsData) => {
        setIsLoading(true);
        try {
            const result = await updateOrganizationSettings({
                name: organizationName,
                currency: data.currency,
                timezone: data.timezone,
            });

            if (result.success) {
                toast.success("Settings updated successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update settings");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>
                    Configure general application preferences.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="currency"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Currency</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select currency" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {CURRENCIES.map((c) => (
                                                    <SelectItem key={c.value} value={c.value}>
                                                        {c.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="timezone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Timezone</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select timezone" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {TIMEZONES.map((tz) => (
                                                    <SelectItem key={tz.value} value={tz.value}>
                                                        {tz.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
