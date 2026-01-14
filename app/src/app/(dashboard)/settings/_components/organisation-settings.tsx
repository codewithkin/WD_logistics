"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Loader2, Building2, Upload } from "lucide-react";
import { updateOrganizationSettings } from "../actions";
import { toast } from "sonner";

const organisationSchema = z.object({
    name: z.string().min(1, "Organisation name is required"),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    logo: z.string().optional(),
});

type OrganisationData = z.infer<typeof organisationSchema>;

interface OrganisationSettingsProps {
    organisation: {
        id: string;
        name: string;
        slug: string;
        logo: string | null;
        email: string;
        phone: string;
        address: string;
    };
}

export function OrganisationSettings({ organisation }: OrganisationSettingsProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<OrganisationData>({
        resolver: zodResolver(organisationSchema),
        defaultValues: {
            name: organisation.name,
            email: organisation.email,
            phone: organisation.phone,
            address: organisation.address,
            logo: organisation.logo || "",
        },
    });

    const onSubmit = async (data: OrganisationData) => {
        setIsLoading(true);
        try {
            const result = await updateOrganizationSettings({
                name: data.name,
                email: data.email || undefined,
                phone: data.phone,
                address: data.address,
                logo: data.logo,
            });

            if (result.success) {
                toast.success("Organisation updated successfully");
                router.refresh();
            } else {
                toast.error(result.error || "Failed to update organisation");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const initials = organisation.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Organisation Profile</CardTitle>
                    <CardDescription>
                        Update your organisation&apos;s profile information.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            {/* Logo Section */}
                            <div className="flex items-center gap-6">
                                <Avatar className="h-20 w-20">
                                    <AvatarImage src={organisation.logo || undefined} />
                                    <AvatarFallback className="text-lg">
                                        {initials || <Building2 className="h-8 w-8" />}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="space-y-2">
                                    <FormField
                                        control={form.control}
                                        name="logo"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Logo URL</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        placeholder="https://example.com/logo.png"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <FormDescription>
                                                    Enter a URL for your organisation logo.
                                                </FormDescription>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Organisation Name</FormLabel>
                                            <FormControl>
                                                <Input placeholder="WD Logistics" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="email"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Email</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="email"
                                                    placeholder="contact@wdlogistics.com"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Phone</FormLabel>
                                        <FormControl>
                                            <Input placeholder="+1 234 567 890" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="address"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Address</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="123 Logistics Ave, City, Country"
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

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
        </div>
    );
}
