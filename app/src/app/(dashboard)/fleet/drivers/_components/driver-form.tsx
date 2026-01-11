"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { DriverStatus, DRIVER_STATUS_LABELS } from "@/lib/types";
import { createDriver, updateDriver } from "../actions";
import { toast } from "sonner";

const driverSchema = z.object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().min(1, "Phone number is required"),
    email: z.string().email().optional().or(z.literal("")),
    whatsappNumber: z.string().optional().or(z.literal("")),
    licenseNumber: z.string().min(1, "License number is required"),
    licenseExpiry: z.date().optional().nullable(),
    passportNumber: z.string().optional().or(z.literal("")),
    dateOfBirth: z.date().optional().nullable(),
    status: z.enum(["active", "on_leave", "suspended", "terminated"]),
    address: z.string().optional(),
    notes: z.string().optional(),
    assignedTruckId: z.string().optional().nullable(),
});

type DriverFormData = z.infer<typeof driverSchema>;

interface Truck {
    id: string;
    registrationNo: string;
}

interface DriverFormProps {
    driver?: {
        id: string;
        firstName: string;
        lastName: string;
        phone: string;
        email: string | null;
        whatsappNumber: string | null;
        licenseNumber: string;
        licenseExpiry: Date | null;
        passportNumber: string | null;
        dateOfBirth: Date | null;
        status: string;
        address: string | null;
        notes: string | null;
        assignedTruckId: string | null;
    };
    availableTrucks: Truck[];
}

export function DriverForm({ driver, availableTrucks }: DriverFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!driver;

    const form = useForm<DriverFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(driverSchema) as any,
        defaultValues: {
            firstName: driver?.firstName ?? "",
            lastName: driver?.lastName ?? "",
            phone: driver?.phone ?? "",
            email: driver?.email ?? "",
            whatsappNumber: driver?.whatsappNumber ?? "",
            licenseNumber: driver?.licenseNumber ?? "",
            licenseExpiry: driver?.licenseExpiry ?? null,
            passportNumber: driver?.passportNumber ?? "",
            dateOfBirth: driver?.dateOfBirth ?? null,
            status: (driver?.status as DriverFormData["status"]) ?? "active",
            address: driver?.address ?? "",
            notes: driver?.notes ?? "",
            assignedTruckId: driver?.assignedTruckId ?? null,
        },
    });

    const onSubmit = async (data: DriverFormData) => {
        setIsLoading(true);
        try {
            const submitData = {
                firstName: data.firstName,
                lastName: data.lastName,
                phone: data.phone,
                email: data.email || undefined,
                whatsappNumber: data.whatsappNumber || undefined,
                licenseNumber: data.licenseNumber,
                licenseExpiry: data.licenseExpiry,
                passportNumber: data.passportNumber || undefined,
                dateOfBirth: data.dateOfBirth,
                status: data.status,
                address: data.address,
                notes: data.notes,
                assignedTruckId: data.assignedTruckId,
            };

            const result = isEditing
                ? await updateDriver(driver.id, submitData)
                : await createDriver(submitData);

            if (result.success) {
                toast.success(isEditing ? "Driver updated successfully" : "Driver created successfully");
                router.push("/fleet/drivers");
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
                        name="firstName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>First Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="John" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="lastName"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Last Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="Doe" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="+1 234 567 8900" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="whatsappNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>WhatsApp Number (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="+1 234 567 8900" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Email (Optional)</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="john@example.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
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
                                        {Object.entries(DRIVER_STATUS_LABELS).map(([value, label]) => (
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="licenseNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>License Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="DL-123456789" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="licenseExpiry"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>License Expiry (Optional)</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ?? undefined}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="passportNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Passport Number (Optional)</FormLabel>
                                <FormControl>
                                    <Input placeholder="Pass123456" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dateOfBirth"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Date of Birth (Optional)</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant="outline"
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? format(field.value, "PPP") : "Pick a date"}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value ?? undefined}
                                            onSelect={field.onChange}
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Address (Optional)</FormLabel>
                            <FormControl>
                                <Input placeholder="123 Main St, City, State" {...field} />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {isEditing && (
                    <FormField
                        control={form.control}
                        name="assignedTruckId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Assigned Truck</FormLabel>
                                <Select
                                    onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                    defaultValue={field.value ?? "none"}
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a truck" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="none">No Truck Assigned</SelectItem>
                                        {availableTrucks.map((truck) => (
                                            <SelectItem key={truck.id} value={truck.id}>
                                                {truck.registrationNo}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes (Optional)</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Additional notes about this driver..."
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
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button type="submit" disabled={isLoading}>
                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        {isEditing ? "Update Driver" : "Create Driver"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
