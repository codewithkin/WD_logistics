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
import { TruckStatus, TRUCK_STATUS_LABELS } from "@/lib/types";
import { createTruck, updateTruck } from "../actions";
import { toast } from "sonner";

// Helper for Zod 4 compatibility with react-hook-form
const numericString = (schema: z.ZodNumber) =>
    z.union([z.string(), z.number()]).pipe(z.coerce.number()).pipe(schema);

const optionalNumericString = (schema: z.ZodNumber) =>
    z.union([z.string(), z.number(), z.undefined()]).pipe(z.coerce.number()).pipe(schema).optional();

const truckSchema = z.object({
    registrationNo: z.string().min(1, "Registration number is required"),
    make: z.string().min(1, "Make is required"),
    model: z.string().min(1, "Model is required"),
    year: numericString(z.number().min(1990).max(new Date().getFullYear() + 1)),
    chassisNumber: z.string().optional(),
    engineNumber: z.string().optional(),
    status: z.enum(["active", "in_service", "in_repair", "inactive", "decommissioned"]),
    currentMileage: numericString(z.number().min(0)),
    fuelType: z.string().optional(),
    tankCapacity: optionalNumericString(z.number().min(0)),
    image: z.string().optional(),
    notes: z.string().optional(),
});

type TruckFormData = z.infer<typeof truckSchema>;

interface TruckFormProps {
    truck?: {
        id: string;
        registrationNo: string;
        make: string;
        model: string;
        year: number;
        chassisNumber: string | null;
        engineNumber: string | null;
        status: string;
        currentMileage: number;
        fuelType: string | null;
        tankCapacity: number | null;
        image: string | null;
        notes: string | null;
    };
}

export function TruckForm({ truck }: TruckFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!truck;

    const form = useForm<TruckFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(truckSchema) as any,
        defaultValues: {
            registrationNo: truck?.registrationNo ?? "",
            make: truck?.make ?? "",
            model: truck?.model ?? "",
            year: truck?.year ?? new Date().getFullYear(),
            chassisNumber: truck?.chassisNumber ?? "",
            engineNumber: truck?.engineNumber ?? "",
            status: (truck?.status as TruckFormData["status"]) ?? "active",
            currentMileage: truck?.currentMileage ?? 0,
            fuelType: truck?.fuelType ?? "",
            tankCapacity: truck?.tankCapacity ?? undefined,
            image: truck?.image ?? "",
            notes: truck?.notes ?? "",
        },
    });

    const onSubmit = async (data: TruckFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateTruck(truck.id, data)
                : await createTruck(data);

            if (result.success) {
                toast.success(isEditing ? "Truck updated successfully" : "Truck created successfully");
                router.push("/fleet/trucks");
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
                                        {Object.entries(TRUCK_STATUS_LABELS).map(([value, label]) => (
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

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="make"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Make</FormLabel>
                                <FormControl>
                                    <Input placeholder="Ford" {...field} />
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
                                    <Input placeholder="F-150" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                        control={form.control}
                        name="chassisNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Chassis Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="Chassis/VIN number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="engineNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Engine Number</FormLabel>
                                <FormControl>
                                    <Input placeholder="Engine number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="currentMileage"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Current Mileage (km)</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="fuelType"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Fuel Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select fuel type" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="diesel">Diesel</SelectItem>
                                        <SelectItem value="petrol">Petrol</SelectItem>
                                        <SelectItem value="electric">Electric</SelectItem>
                                        <SelectItem value="hybrid">Hybrid</SelectItem>
                                        <SelectItem value="cng">CNG</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="tankCapacity"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tank Capacity (L)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.1" {...field} />
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
                            <FormLabel>Image URL</FormLabel>
                            <FormControl>
                                <Input placeholder="https://..." {...field} />
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
                                    placeholder="Additional notes about this truck..."
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
                        {isEditing ? "Update Truck" : "Create Truck"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
