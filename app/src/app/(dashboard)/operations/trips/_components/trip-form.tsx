"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import { TripStatus, TRIP_STATUS_LABELS } from "@/lib/types";
import { createTrip, updateTrip } from "../actions";
import { toast } from "sonner";

// Helper for Zod 4 compatibility with react-hook-form
const numericString = (schema: z.ZodNumber) =>
    z.union([z.string(), z.number()]).pipe(z.coerce.number()).pipe(schema);

const optionalNumericString = (schema: z.ZodNumber) =>
    z.union([z.string(), z.number(), z.undefined(), z.null()]).pipe(z.coerce.number()).pipe(schema).optional().nullable();

const tripSchema = z.object({
    originCity: z.string().min(1, "Origin city is required"),
    originAddress: z.string().optional(),
    destinationCity: z.string().min(1, "Destination city is required"),
    destinationAddress: z.string().optional(),
    loadDescription: z.string().optional(),
    loadWeight: optionalNumericString(z.number()),
    loadUnits: optionalNumericString(z.number().int()),
    estimatedMileage: numericString(z.number().int().min(1, "Estimated mileage is required")),
    actualMileage: optionalNumericString(z.number().int()),
    startOdometer: optionalNumericString(z.number().int()),
    endOdometer: optionalNumericString(z.number().int()),
    revenue: numericString(z.number().min(0, "Revenue must be positive")),
    status: z.enum(["scheduled", "in_progress", "completed", "cancelled"]),
    scheduledDate: z.date({ error: "Scheduled date is required" }),
    startDate: z.date().optional().nullable(),
    endDate: z.date().optional().nullable(),
    truckId: z.string().min(1, "Truck is required"),
    driverId: z.string().min(1, "Driver is required"),
    customerId: z.string().optional().nullable(),
    notes: z.string().optional(),
});

type TripFormData = z.infer<typeof tripSchema>;

interface TripFormProps {
    trip?: {
        id: string;
        originCity: string;
        originAddress: string | null;
        destinationCity: string;
        destinationAddress: string | null;
        loadDescription: string | null;
        loadWeight: number | null;
        loadUnits: number | null;
        estimatedMileage: number;
        actualMileage: number | null;
        startOdometer: number | null;
        endOdometer: number | null;
        revenue: number;
        status: string;
        scheduledDate: Date;
        startDate: Date | null;
        endDate: Date | null;
        truckId: string;
        driverId: string;
        customerId: string | null;
        notes: string | null;
    };
    trucks: Array<{ id: string; registrationNo: string }>;
    drivers: Array<{ id: string; firstName: string; lastName: string }>;
    customers: Array<{ id: string; name: string }>;
}

export function TripForm({ trip, trucks, drivers, customers }: TripFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!trip;

    const form = useForm<TripFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(tripSchema) as any,
        defaultValues: {
            originCity: trip?.originCity ?? "",
            originAddress: trip?.originAddress ?? "",
            destinationCity: trip?.destinationCity ?? "",
            destinationAddress: trip?.destinationAddress ?? "",
            loadDescription: trip?.loadDescription ?? "",
            loadWeight: trip?.loadWeight ?? null,
            loadUnits: trip?.loadUnits ?? null,
            estimatedMileage: trip?.estimatedMileage ?? 0,
            actualMileage: trip?.actualMileage ?? null,
            startOdometer: trip?.startOdometer ?? null,
            endOdometer: trip?.endOdometer ?? null,
            revenue: trip?.revenue ?? 0,
            status: (trip?.status as TripFormData["status"]) ?? "scheduled",
            scheduledDate: trip?.scheduledDate ?? undefined,
            startDate: trip?.startDate ?? null,
            endDate: trip?.endDate ?? null,
            truckId: trip?.truckId ?? "",
            driverId: trip?.driverId ?? "",
            customerId: trip?.customerId ?? null,
            notes: trip?.notes ?? "",
        },
    });

    const onSubmit = async (data: TripFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateTrip(trip.id, {
                    ...data,
                    customerId: data.customerId || null,
                })
                : await createTrip({
                    ...data,
                    customerId: data.customerId || null,
                });

            if (result.success) {
                toast.success(isEditing ? "Trip updated successfully" : "Trip created successfully");
                router.push("/operations/trips");
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
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardContent className="grid gap-6 pt-6">
                        {/* Route Information */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="originCity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Origin City</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Harare" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="destinationCity"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Destination City</FormLabel>
                                        <FormControl>
                                            <Input placeholder="e.g. Nyamapanda" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="originAddress"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Origin Address (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Full address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="destinationAddress"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Destination Address (Optional)</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Full address" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Assignment */}
                        <div className="grid gap-4 md:grid-cols-3">
                            <FormField
                                control={form.control}
                                name="truckId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Truck</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a truck" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {trucks.map((truck) => (
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
                            <FormField
                                control={form.control}
                                name="driverId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Driver</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a driver" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {drivers.map((driver) => (
                                                    <SelectItem key={driver.id} value={driver.id}>
                                                        {driver.firstName} {driver.lastName}
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
                                name="customerId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Customer (Optional)</FormLabel>
                                        <Select
                                            onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                                            defaultValue={field.value ?? "none"}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a customer" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="none">No Customer</SelectItem>
                                                {customers.map((customer) => (
                                                    <SelectItem key={customer.id} value={customer.id}>
                                                        {customer.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Dates */}
                        <div className="grid gap-4 md:grid-cols-4">
                            <FormField
                                control={form.control}
                                name="scheduledDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Scheduled Date</FormLabel>
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
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start Date (Optional)</FormLabel>
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
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>End Date (Optional)</FormLabel>
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
                                                {Object.entries(TRIP_STATUS_LABELS).map(([value, label]) => (
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

                        {/* Load Information */}
                        <FormField
                            control={form.control}
                            name="loadDescription"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Load Description (Optional)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Describe the cargo..." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="loadWeight"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Load Weight (kg)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.1"
                                                placeholder="0"
                                                {...field}
                                                value={field.value ?? ""}
                                                onChange={(e) =>
                                                    field.onChange(e.target.value ? Number(e.target.value) : null)
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="loadUnits"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Load Units (Optional)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                placeholder="0"
                                                {...field}
                                                value={field.value ?? ""}
                                                onChange={(e) =>
                                                    field.onChange(e.target.value ? Number(e.target.value) : null)
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* Mileage & Financial */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="estimatedMileage"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Estimated Mileage (km)</FormLabel>
                                        <FormControl>
                                            <Input type="number" placeholder="0" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="revenue"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Revenue ($)</FormLabel>
                                        <FormControl>
                                            <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {isEditing && (
                            <div className="grid gap-4 md:grid-cols-3">
                                <FormField
                                    control={form.control}
                                    name="actualMileage"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Actual Mileage (km)</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value ? Number(e.target.value) : null)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="startOdometer"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Start Odometer</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value ? Number(e.target.value) : null)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="endOdometer"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>End Odometer</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="0"
                                                    {...field}
                                                    value={field.value ?? ""}
                                                    onChange={(e) =>
                                                        field.onChange(e.target.value ? Number(e.target.value) : null)
                                                    }
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                        )}

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes (Optional)</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional notes about this trip..."
                                            className="min-h-[100px]"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </CardContent>
                    <CardFooter className="flex justify-end gap-2">
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
                            {isEditing ? "Update Trip" : "Create Trip"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
