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
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { InvoiceStatus, INVOICE_STATUS_LABELS } from "@/lib/types";
import { createInvoice, updateInvoice } from "../actions";
import { toast } from "sonner";

const invoiceSchema = z.object({
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    customerId: z.string().min(1, "Customer is required"),
    issueDate: z.date({ message: "Issue date is required" }),
    dueDate: z.date({ message: "Due date is required" }),
    subtotal: z.coerce.number().min(0),
    tax: z.coerce.number().min(0),
    status: z.enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"]),
    notes: z.string().optional(),
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
    invoice?: {
        id: string;
        invoiceNumber: string;
        customerId: string;
        issueDate: Date;
        dueDate: Date;
        subtotal: number;
        tax: number;
        total: number;
        amountPaid: number;
        balance: number;
        status: string;
        notes: string | null;
    };
    customers: Array<{ id: string; name: string }>;
    defaultInvoiceNumber: string;
    prefilledCustomerId?: string;
    prefilledSubtotal?: number;
}

export function InvoiceForm({
    invoice,
    customers,
    defaultInvoiceNumber,
    prefilledCustomerId,
    prefilledSubtotal,
}: InvoiceFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!invoice;

    const form = useForm<InvoiceFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(invoiceSchema) as any,
        defaultValues: {
            invoiceNumber: invoice?.invoiceNumber ?? defaultInvoiceNumber,
            customerId: invoice?.customerId ?? prefilledCustomerId ?? "",
            issueDate: invoice?.issueDate ?? new Date(),
            dueDate: invoice?.dueDate ?? addDays(new Date(), 30),
            subtotal: invoice?.subtotal ?? prefilledSubtotal ?? 0,
            tax: invoice?.tax ?? 0,
            status: (invoice?.status as InvoiceFormData["status"]) ?? "draft",
            notes: invoice?.notes ?? "",
        },
    });

    const subtotal = form.watch("subtotal");
    const tax = form.watch("tax");
    const total = subtotal + tax;
    const amountPaid = invoice?.amountPaid ?? 0;
    const balance = total - amountPaid;

    const onSubmit = async (data: InvoiceFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateInvoice(invoice.id, {
                    ...data,
                    total,
                    balance,
                })
                : await createInvoice({
                    ...data,
                    total,
                    balance: total,
                    amountPaid: 0,
                });

            if (result.success) {
                toast.success(isEditing ? "Invoice updated successfully" : "Invoice created successfully");
                router.push("/finance/invoices");
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
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="invoiceNumber"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Invoice Number</FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="customerId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Customer</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select a customer" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
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
                                        {Object.entries(INVOICE_STATUS_LABELS).map(([value, label]) => (
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
                        name="issueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Issue Date</FormLabel>
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
                        name="dueDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Due Date</FormLabel>
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <FormField
                        control={form.control}
                        name="subtotal"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Subtotal ($)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="tax"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Tax ($)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex flex-col justify-end">
                        <div className="rounded-md border p-3">
                            <p className="text-sm text-muted-foreground">Total</p>
                            <p className="text-2xl font-bold">${total.toLocaleString()}</p>
                            {isEditing && amountPaid > 0 && (
                                <div className="mt-2 text-sm">
                                    <p className="text-muted-foreground">Paid: ${amountPaid.toLocaleString()}</p>
                                    <p className="text-muted-foreground">Balance: ${balance.toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Additional notes for this invoice..."
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
                        {isEditing ? "Update Invoice" : "Create Invoice"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
