"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
    Form,
    FormControl,
    FormDescription,
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
import { CalendarIcon, Loader2, CreditCard } from "lucide-react";
import { format, addDays } from "date-fns";
import { cn } from "@/lib/utils";
import { InvoiceStatus, INVOICE_STATUS_LABELS } from "@/lib/types";
import { createInvoice, updateInvoice } from "../actions";
import { toast } from "sonner";

const invoiceSchema = z.object({
    customerId: z.string().min(1, "Customer is required"),
    isCredit: z.boolean().default(false),
    dueDate: z.date().optional().nullable(),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    status: z.enum(["draft", "sent", "paid", "partial", "overdue", "cancelled"]),
    notes: z.string().optional(),
    tripId: z.string().optional().nullable(),
}).refine((data) => {
    // If it's a credit invoice, due date is required
    if (data.isCredit && !data.dueDate) {
        return false;
    }
    return true;
}, {
    message: "Due date is required for credit invoices",
    path: ["dueDate"],
});

type InvoiceFormData = z.infer<typeof invoiceSchema>;

interface InvoiceFormProps {
    invoice?: {
        id: string;
        invoiceNumber: string;
        customerId: string;
        issueDate: Date;
        dueDate: Date | null;
        subtotal: number;
        tax: number;
        total: number;
        amountPaid: number;
        balance: number;
        status: string;
        notes: string | null;
        isCredit?: boolean;
        tripId?: string | null;
    };
    customers: Array<{ id: string; name: string }>;
    prefilledCustomerId?: string;
    prefilledAmount?: number;
    prefilledTripId?: string;
}

export function InvoiceForm({
    invoice,
    customers,
    prefilledCustomerId,
    prefilledAmount,
    prefilledTripId,
}: InvoiceFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!invoice;

    const form = useForm<InvoiceFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(invoiceSchema) as any,
        defaultValues: {
            customerId: invoice?.customerId ?? prefilledCustomerId ?? "",
            isCredit: invoice?.isCredit ?? false,
            dueDate: invoice?.dueDate ?? addDays(new Date(), 30),
            tripId: invoice?.tripId ?? prefilledTripId ?? null,
            amount: invoice?.subtotal ?? prefilledAmount ?? 0,
            status: (invoice?.status as InvoiceFormData["status"]) ?? "draft",
            notes: invoice?.notes ?? "",
        },
    });

    const amount = form.watch("amount");
    const isCredit = form.watch("isCredit");
    const amountPaid = invoice?.amountPaid ?? 0;
    const balance = amount - amountPaid;

    const onSubmit = async (data: InvoiceFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updateInvoice(invoice.id, {
                    customerId: data.customerId,
                    isCredit: data.isCredit,
                    dueDate: data.isCredit ? data.dueDate : null,
                    tripId: data.tripId,
                    subtotal: data.amount,
                    tax: 0,
                    total: data.amount,
                    balance: data.amount - amountPaid,
                    status: data.status,
                    notes: data.notes,
                })
                : await createInvoice({
                    customerId: data.customerId,
                    isCredit: data.isCredit,
                    dueDate: data.isCredit ? data.dueDate : null,
                    tripId: data.tripId,
                    amount: data.amount,
                    status: data.status,
                    notes: data.notes,
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
                <div className="grid gap-4 sm:grid-cols-2">
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
                    )}
                </div>

                {/* Credit Invoice Toggle */}
                <FormField
                    control={form.control}
                    name="isCredit"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base flex items-center gap-2">
                                    <CreditCard className="h-4 w-4" />
                                    Credit Invoice
                                </FormLabel>
                                <FormDescription>
                                    Enable this if the customer will pay later (payment on credit terms)
                                </FormDescription>
                            </div>
                            <FormControl>
                                <Switch
                                    checked={field.value}
                                    onCheckedChange={field.onChange}
                                />
                            </FormControl>
                        </FormItem>
                    )}
                />

                <div className="grid gap-4 sm:grid-cols-2">
                    {/* Only show Due Date if it's a credit invoice */}
                    {isCredit && (
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
                    )}
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Amount ($)</FormLabel>
                                <FormControl>
                                    <Input type="number" step="0.01" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="rounded-md border p-4 bg-muted/50">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">Total Amount</p>
                        <p className="text-2xl font-bold">${amount.toLocaleString()}</p>
                    </div>
                    {isEditing && amountPaid > 0 && (
                        <div className="mt-2 flex gap-4 text-sm">
                            <p className="text-muted-foreground">Paid: ${amountPaid.toLocaleString()}</p>
                            <p className="text-muted-foreground">Balance: ${balance.toLocaleString()}</p>
                        </div>
                    )}
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
