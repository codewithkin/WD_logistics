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
import { PaymentMethod, PAYMENT_METHOD_LABELS } from "@/lib/types";
import { createPayment, updatePayment } from "../actions";
import { toast } from "sonner";

const paymentSchema = z.object({
    invoiceId: z.string().min(1, "Invoice is required"),
    customerId: z.string().min(1, "Customer is required"),
    amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
    paymentDate: z.date({ message: "Payment date is required" }),
    method: z.enum(["cash", "check", "bank_transfer", "mobile_money", "other"]),
    customMethod: z.string().optional(),
    notes: z.string().optional(),
}).refine((data) => {
    // If method is "other", customMethod is required
    if (data.method === "other" && (!data.customMethod || data.customMethod.trim() === "")) {
        return false;
    }
    return true;
}, {
    message: "Please specify the payment method",
    path: ["customMethod"],
});

type PaymentFormData = z.infer<typeof paymentSchema>;

interface PaymentFormProps {
    payment?: {
        id: string;
        invoiceId: string;
        customerId: string;
        amount: number;
        paymentDate: Date;
        method: string;
        customMethod: string | null;
        notes: string | null;
    };
    invoices: Array<{
        id: string;
        invoiceNumber: string;
        total: number;
        balance: number;
        customerId: string;
        customer: { name: string };
    }>;
    defaultInvoiceId?: string;
}

export function PaymentForm({ payment, invoices, defaultInvoiceId }: PaymentFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const isEditing = !!payment;

    // Get customerId from selected invoice
    const getCustomerIdFromInvoice = (invoiceId: string) => {
        const invoice = invoices.find((i) => i.id === invoiceId);
        return invoice?.customerId ?? "";
    };

    const form = useForm<PaymentFormData>({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        resolver: zodResolver(paymentSchema) as any,
        defaultValues: {
            invoiceId: payment?.invoiceId ?? defaultInvoiceId ?? "",
            customerId: payment?.customerId ?? getCustomerIdFromInvoice(defaultInvoiceId ?? ""),
            amount: payment?.amount ?? 0,
            paymentDate: payment?.paymentDate ?? new Date(),
            method: (payment?.method as PaymentFormData["method"]) ?? "bank_transfer",
            customMethod: payment?.customMethod ?? "",
            notes: payment?.notes ?? "",
        },
    });

    const selectedInvoiceId = form.watch("invoiceId");
    const selectedMethod = form.watch("method");
    const selectedInvoice = invoices.find((i) => i.id === selectedInvoiceId);

    // Update customerId when invoice changes
    const handleInvoiceChange = (invoiceId: string) => {
        const invoice = invoices.find((i) => i.id === invoiceId);
        if (invoice) {
            form.setValue("customerId", invoice.customerId);
        }
    };

    const onSubmit = async (data: PaymentFormData) => {
        setIsLoading(true);
        try {
            const result = isEditing
                ? await updatePayment(payment.id, {
                    ...data,
                    customMethod: data.method === "other" ? data.customMethod : undefined,
                })
                : await createPayment({
                    ...data,
                    customMethod: data.method === "other" ? data.customMethod : undefined,
                });

            if (result.success) {
                toast.success(isEditing ? "Payment updated successfully" : "Payment recorded successfully");
                router.push("/finance/payments");
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
                        <FormField
                            control={form.control}
                            name="invoiceId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Invoice</FormLabel>
                                    <Select
                                        onValueChange={(value) => {
                                            field.onChange(value);
                                            handleInvoiceChange(value);
                                        }}
                                        defaultValue={field.value}
                                        disabled={isEditing}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select an invoice" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {invoices.map((invoice) => (
                                                <SelectItem key={invoice.id} value={invoice.id}>
                                                    {invoice.invoiceNumber} - {invoice.customer.name} (Balance: $
                                                    {invoice.balance.toLocaleString()})
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {selectedInvoice && (
                            <div className="rounded-md border p-4 bg-muted/50">
                                <div className="grid gap-2 md:grid-cols-3">
                                    <div>
                                        <p className="text-sm text-muted-foreground">Invoice Total</p>
                                        <p className="font-medium">${selectedInvoice.total.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                                        <p className="font-medium text-amber-600">
                                            ${selectedInvoice.balance.toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Customer</p>
                                        <p className="font-medium">{selectedInvoice.customer.name}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="grid gap-4 md:grid-cols-2">
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
                                                    disabled={(date) => date > new Date()}
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
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
                                            <Input placeholder="e.g., Swupe, PayPal, Crypto..." {...field} />
                                        </FormControl>
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
                                    <FormLabel>Notes</FormLabel>
                                    <FormControl>
                                        <Textarea
                                            placeholder="Additional notes about this payment..."
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
                            {isEditing ? "Update Payment" : "Record Payment"}
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
