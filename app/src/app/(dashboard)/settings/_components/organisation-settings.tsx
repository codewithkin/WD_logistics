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
    altPhone: z.string().optional(),
    website: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    vatNumber: z.string().optional(),
    bpNumber: z.string().optional(),
    bankDetails: z.string().optional(),
    invoiceTerms: z.string().optional(),
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
        altPhone: string;
        website: string;
        addressLine1: string;
        addressLine2: string;
        city: string;
        country: string;
        vatNumber: string;
        bpNumber: string;
        bankDetails: string;
        invoiceTerms: string;
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
            altPhone: organisation.altPhone,
            website: organisation.website,
            addressLine1: organisation.addressLine1,
            addressLine2: organisation.addressLine2,
            city: organisation.city,
            country: organisation.country,
            vatNumber: organisation.vatNumber,
            bpNumber: organisation.bpNumber,
            bankDetails: organisation.bankDetails,
            invoiceTerms: organisation.invoiceTerms,
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
                altPhone: data.altPhone,
                website: data.website,
                addressLine1: data.addressLine1,
                addressLine2: data.addressLine2,
                city: data.city,
                country: data.country,
                vatNumber: data.vatNumber,
                bpNumber: data.bpNumber,
                bankDetails: data.bankDetails,
                invoiceTerms: data.invoiceTerms,
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
                                            <Input placeholder="+263 772 958 986" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            {/* The letterhead.
                                Every one of these fields existed on the
                                organisation and no form wrote any of them, so
                                the invoices, statements and receipts printed
                                the hardcoded address in lib/documents/brand.ts
                                and the "Payment details" and "Terms" blocks
                                never appeared at all. Blank still falls back
                                to the printed stationery. */}
                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="altPhone"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Second phone</FormLabel>
                                            <FormControl>
                                                <Input placeholder="+263 772 000 000" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="website"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Website</FormLabel>
                                            <FormControl>
                                                <Input placeholder="wd-logistics.co.zw" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="addressLine1"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address line 1</FormLabel>
                                            <FormControl>
                                                <Input placeholder="1 Tameside Close" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="addressLine2"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Address line 2</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="Nyakamete Industrial Area"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="city"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Mutare" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="country"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Country</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Zimbabwe" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <FormField
                                    control={form.control}
                                    name="vatNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>VAT number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="10000000" {...field} />
                                            </FormControl>
                                            <FormDescription>
                                                Printed as &quot;VAT No.&quot; on invoices.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bpNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>BP number</FormLabel>
                                            <FormControl>
                                                <Input placeholder="0000000000" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <FormField
                                control={form.control}
                                name="bankDetails"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment details</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                className="min-h-24"
                                                placeholder={"Bank: CBZ\nAccount name: WD Logistics\nAccount number: 00000000000"}
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Printed under &quot;Payment details&quot; on every
                                            invoice. Left blank, the block is left off.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="invoiceTerms"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Invoice terms</FormLabel>
                                        <FormControl>
                                            <Textarea
                                                placeholder="Payment due within 30 days of invoice date."
                                                {...field}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            The short terms line at the foot of an invoice.
                                        </FormDescription>
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
