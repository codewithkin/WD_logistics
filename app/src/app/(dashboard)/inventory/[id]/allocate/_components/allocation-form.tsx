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
import { Loader2 } from "lucide-react";
import { allocateInventory } from "../../actions";
import { toast } from "sonner";

const allocationSchema = z.object({
    quantity: z.coerce.number().min(1, "Quantity must be at least 1"),
    truckId: z.string().min(1, "Please select a truck"),
    allocatedById: z.string().min(1, "Please select an employee"),
    reason: z.string().min(1, "Please provide a reason"),
});

type AllocationFormData = z.infer<typeof allocationSchema>;

interface AllocationFormProps {
    inventoryItemId: string;
    item: {
        name: string;
        quantity: number;
    };
    trucks: Array<{
        id: string;
        plateNumber: string;
    }>;
    employees: Array<{
        id: string;
        firstName: string;
        lastName: string;
        role: string;
    }>;
}

export function AllocationForm({
    inventoryItemId,
    item,
    trucks,
    employees,
}: AllocationFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<AllocationFormData>({
        resolver: zodResolver(allocationSchema),
        defaultValues: {
            quantity: 1,
            truckId: "",
            allocatedById: "",
            reason: "",
        },
    });

    const onSubmit = async (data: AllocationFormData) => {
        setIsLoading(true);
        try {
            const result = await allocateInventory({
                inventoryItemId,
                quantity: data.quantity,
                truckId: data.truckId,
                allocatedById: data.allocatedById,
                reason: data.reason,
            });

            if (result.success) {
                toast.success("Inventory allocated successfully");
                router.push(`/inventory/${inventoryItemId}`);
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
                        <div className="rounded-md border p-4 bg-muted/50">
                            <p className="font-medium">{item.name}</p>
                            <p className="text-sm text-muted-foreground">
                                Available: {item.quantity} units
                            </p>
                        </div>

                        <FormField
                            control={form.control}
                            name="quantity"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Quantity to Allocate</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            min="1"
                                            max={item.quantity}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                                    {truck.plateNumber}
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
                            name="allocatedById"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Allocated By (Employee)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an employee" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {employees.map((emp) => (
                                                <SelectItem key={emp.id} value={emp.id}>
                                                    {emp.firstName} {emp.lastName} ({emp.role})
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
                            name="reason"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Reason for Allocation</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Explain why this inventory is being allocated..."
                                            className="min-h-[80px]"
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
                            Allocate
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
