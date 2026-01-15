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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Calendar } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { createSupplierPayment, updateSupplierPayment } from "../actions";
import { PAYMENT_METHOD_LABELS } from "@/lib/types";
import { toast } from "sonner";

const supplierPaymentSchema = z.object({
    supplierId: z.string().min(1, "Supplier is required"),
    amount: z.number().min(0.01, "Amount must be greater than 0"),
    paymentDate: z.date(),
    method: z.string().min(1, "Payment method is required"),
    customMethod: z.string().optional(),
    reference: z.string().optional(),
    description: z.string().optional(),
    notes: z.string().optional(),
});

type SupplierPaymentFormData = z.infer<typeof supplierPaymentSchema>;

interface Supplier {
    id: string;
    name: string;
    balance: number;
}

interface SupplierPaymentFormProps {
    suppliers: Supplier[];
    defaultSupplierId?: string;
    payment?: {
        id: string;
        supplierId: string;
        amount: number;
        paymentDate: Date;
        method: string;
        customMethod: string | null;
        reference: string | null;
        description: string | null;
        notes: string | null;
    };
}

export function SupplierPaymentForm({ suppliers, defaultSupplierId, payment }: SupplierPaymentFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!payment;

    const form = useForm<SupplierPaymentFormData>({
        resolver: zodResolver(supplierPaymentSchema),
        defaultValues: {
            supplierId: payment?.supplierId ?? defaultSupplierId ?? "",
            amount: payment?.amount ?? 0,
            paymentDate: payment?.paymentDate ? new Date(payment.paymentDate) : new Date(),
            method: payment?.method ?? "bank_transfer",
            customMethod: payment?.customMethod ?? "",
            reference: payment?.reference ?? "",
            description: payment?.description ?? "",
            notes: payment?.notes ?? "",
        },
    });

    const selectedMethod = form.watch("method");
    const selectedSupplierId = form.watch("supplierId");
    const selectedSupplier = suppliers.find(s => s.id === selectedSupplierId);

    const onSubmit = async (data: SupplierPaymentFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateSupplierPayment(payment.id, {
                    amount: data.amount,
                    paymentDate: data.paymentDate,
                    method: data.method as "cash" | "bank_transfer" | "check" | "mobile_money" | "other",
                    customMethod: data.customMethod,
                    reference: data.reference,
                    description: data.description,
                    notes: data.notes,
                })
                : await createSupplierPayment({
                    supplierId: data.supplierId,
                    amount: data.amount,
                    paymentDate: data.paymentDate,
                    method: data.method as "cash" | "bank_transfer" | "check" | "mobile_money" | "other",
                    customMethod: data.customMethod,
                    reference: data.reference,
                    description: data.description,
                    notes: data.notes,
                });

            if (result.success) {
                toast.success(isEditing ? "Payment updated successfully" : "Payment recorded successfully");
                router.push("/finance/supplier-payments");
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
        <Card>
            <CardContent className="pt-6">
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="supplierId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Supplier</FormLabel>
                                        <Select
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            disabled={isEditing}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select supplier" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {suppliers.map((supplier) => (
                                                    <SelectItem key={supplier.id} value={supplier.id}>
                                                        {supplier.name}
                                                        {supplier.balance > 0 && (
                                                            <span className="text-muted-foreground ml-2">
                                                                (Owed: ${supplier.balance.toLocaleString()})
                                                            </span>
                                                        )}
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
                                name="amount"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Amount</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                step="0.01"
                                                placeholder="0.00"
                                                {...field}
                                                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                            />
                                        </FormControl>
                                        {selectedSupplier && selectedSupplier.balance > 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                Balance owed: ${selectedSupplier.balance.toLocaleString()}
                                            </p>
                                        )}
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="paymentDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Payment Date</FormLabel>
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
                                                        {field.value ? (
                                                            format(field.value, "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <Calendar className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <CalendarComponent
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
                                name="method"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Payment Method</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select method" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
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

                        {selectedMethod === "other" && (
                            <FormField
                                control={form.control}
                                name="customMethod"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Custom Payment Method</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Enter payment method" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <FormField
                                control={form.control}
                                name="reference"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Reference Number</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Check #, Transfer ID, etc." {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="description"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Description</FormLabel>
                                        <FormControl>
                                            <Input placeholder="What is this payment for?" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <FormField
                            control={form.control}
                            name="notes"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional notes..."
                                            className="min-h-20"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <div className="flex gap-4">
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
                                {isEditing ? "Update Payment" : "Record Payment"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
