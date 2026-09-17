"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ui/image-upload";
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
import { TRAILER_STATUS_LABELS } from "@/lib/types";
import { createTrailer, updateTrailer } from "../actions";
import { toast } from "sonner";
import { ExpiryReminderPopover } from "@/components/fleet/expiry-reminder-popover";
import type { ReminderDays } from "@/lib/expiry-reminders";

// Helper for Zod 4 compatibility with react-hook-form
const numericString = (schema: z.ZodNumber) =>
    z.union([z.string(), z.number()]).pipe(z.coerce.number()).pipe(schema);

const trailerSchema = z.object({
    registrationNo: z.string().min(1, "Registration number is required"),
    make: z.string().min(1, "Make is required"),
    model: z.string().min(1, "Model is required"),
    year: numericString(z.number().min(1990).max(new Date().getFullYear() + 1)),
    status: z.enum(["active", "in_service", "in_repair", "inactive", "decommissioned"]),
    type: z.string().optional(),
    licenseNumber: z.string().optional(),
    licenseExpiration: z.string().optional(),
    image: z.string().optional(),
    notes: z.string().optional(),
});

type TrailerFormData = z.infer<typeof trailerSchema>;

interface TrailerFormProps {
    trailer?: {
        id: string;
        registrationNo: string;
        make: string;
        model: string;
        year: number;
        status: string;
        type: string | null;
        licenseNumber: string | null;
        licenseExpiration: Date | null;
        image: string | null;
        notes: string | null;
    };
    reminders?: ReminderDays;
}

export function TrailerForm({ trailer, reminders: initialReminders }: TrailerFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const [reminders, setReminders] = useState<ReminderDays>(initialReminders ?? {});
    const isEditing = !!trailer;

    const form = useForm<TrailerFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(trailerSchema) as any,
        defaultValues: {
            registrationNo: trailer?.registrationNo ?? "",
            make: trailer?.make ?? "",
            model: trailer?.model ?? "",
            year: trailer?.year ?? undefined,
            status: (trailer?.status as TrailerFormData["status"]) ?? "active",
            type: trailer?.type ?? "",
            licenseNumber: trailer?.licenseNumber ?? "",
            licenseExpiration: trailer?.licenseExpiration
                ? trailer.licenseExpiration.toISOString().split("T")[0]
                : "",
            image: trailer?.image ?? "",
            notes: trailer?.notes ?? "",
        },
    });

    const onSubmit = async (data: TrailerFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateTrailer(trailer.id, { ...data, reminders })
                : await createTrailer({ ...data, reminders });

            if (result.success) {
                toast.success(isEditing ? "Trailer updated successfully" : "Trailer created successfully");
                router.push("/fleet/trailers");
            } else {
                toast.error(result.error || "An error occurred");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="registrationNo"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Registration Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="ABC-1234" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {isEditing && (
                        <FormField
                            control={form.control}
                            name="status"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Status</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select status" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.entries(TRAILER_STATUS_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="make"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Make</FormLabel>
                                <FormControl>
                                    <Input placeholder="Henred" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Model</FormLabel>
                                <FormControl>
                                    <Input placeholder="Flatbed 40ft" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="year"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Year</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="type"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Type</FormLabel>
                                <FormControl>
                                    <Input placeholder="Flatbed, reefer, tanker, container..." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>License Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="License disc number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="licenseExpiration"
                        render={({ field }) => (
                            <FormItem>
                                <div className="flex items-center justify-between gap-2">
                                    <FormLabel>License Expiration</FormLabel>
                                    <ExpiryReminderPopover
                                        documentLabel="Trailer License"
                                        value={reminders.licenseExpiration ?? []}
                                        onChange={(days) => setReminders((prev) => ({ ...prev, licenseExpiration: days }))}
                                        disabled={isLoading}
                                    />
                                </div>
                                <FormControl>
                                    <Input type="date" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="image"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Trailer Image</FormLabel>
                            <FormControl>
                                <ImageUpload
                                    value={field.value}
                                    onChange={field.onChange}
                                    onUploadingChange={setIsUploading}
                                    folder="trailers"
                                    placeholder="Upload trailer image"
                                    aspect="video"
                                    disabled={isLoading}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Additional notes about this trailer..."
                                    className="min-h-25"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-2 pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => router.back()}
                        disabled={isLoading || isUploading}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading || isUploading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Update Trailer" : "Create Trailer"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
