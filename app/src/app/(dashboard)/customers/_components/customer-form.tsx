"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
    ApprovalNotice,
    isPendingApproval,
} from "@/components/ui/approval-notice";
import { useSession } from "@/components/providers/session-provider";
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
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { createCustomer, updateCustomer } from "../actions";
import { toast } from "sonner";

const customerSchema = z.object({
    name: z.string().min(1, "Name is required"),
    email: z.string().email().optional().or(z.literal("")),
    phone: z.string().optional(),
    address: z.string().optional(),
    contactPerson: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(["active", "inactive", "suspended"]),
});

type CustomerFormData = z.infer<typeof customerSchema>;

interface CustomerFormProps {
    customer?: {
        id: string;
        name: string;
        email: string | null;
        phone: string | null;
        address: string | null;
        contactPerson: string | null;
        notes: string | null;
        status: string;
    };
}

export function CustomerForm({ customer }: CustomerFormProps) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    // Non-admins are editing a request, not the record — see
    // lib/edit-requests/gate.ts. The banner below says so, and the
    // reason travels with the change for the admin who reviews it.
    const { role } = useSession();
    const needsApproval = role !== "admin";
    const [approvalReason, setApprovalReason] = useState("");
    const [reasonError, setReasonError] = useState<string | undefined>();
    const isEditing = !!customer;

    const form = useForm<CustomerFormData>({
        resolver: zodResolver(customerSchema),
        defaultValues: {
            name: customer?.name ?? "",
            email: customer?.email ?? "",
            phone: customer?.phone ?? "",
            address: customer?.address ?? "",
            contactPerson: customer?.contactPerson ?? "",
            notes: customer?.notes ?? "",
            status: (customer?.status as "active" | "inactive" | "suspended") ?? "active",
        },
    });

    const onSubmit = async (data: CustomerFormData) => {
        setIsLoading(true);
        try {
            if (isEditing && needsApproval && approvalReason.trim().length < 5) {
                setReasonError("Give a short reason so the admin knows why.");
                setIsLoading(false);
                return;
            }
            const result = isEditing
                ? await updateCustomer(customer.id, {
                    ...data,
                    email: data.email || undefined,
                }, approvalReason)
                : await createCustomer({
                    ...data,
                    email: data.email || undefined,
                });

            if (isPendingApproval(result)) {

                toast.success(result.message);

                router.push("/edit-requests");

                return;

            }

            if (result.success) {
                toast.success(
                    isEditing ? "Customer updated successfully" : "Customer created successfully"
                );
                router.push("/customers");
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
                        name="name"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Company Name</FormLabel>
                                <FormControl>
                                    <Input placeholder="ABC Logistics Inc." {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="contactPerson"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Contact Person</FormLabel>
                                <FormControl>
                                    <Input placeholder="John Smith" {...field} />
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
                                <FormLabel>Email</FormLabel>
                                <FormControl>
                                    <Input type="email" placeholder="contact@company.com" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="phone"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Phone</FormLabel>
                                <FormControl>
                                    <Input placeholder="+1 234 567 8900" {...field} />
                                </FormControl>
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
                            <FormLabel>Address</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="123 Business St, City, State, ZIP"
                                    className="min-h-20"
                                    {...field}
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
                                    placeholder="Additional notes about this customer..."
                                    className="min-h-25"
                                    {...field}
                                />
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
                                        <SelectItem value="active">Active</SelectItem>
                                        <SelectItem value="inactive">Inactive</SelectItem>
                                        <SelectItem value="suspended">Suspended</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormDescription>
                                    Inactive/suspended customers won&apos;t appear in trip/invoice dropdowns
                                </FormDescription>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                )}

                {isEditing && needsApproval && (

                    <ApprovalNotice

                        value={approvalReason}

                        onChange={(value) => {

                            setApprovalReason(value);

                            setReasonError(undefined);

                        }}

                        noun="customer"

                        error={reasonError}

                    />

                )}


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
                        {isEditing ? "Update Customer" : "Create Customer"}
                    </Button>
                </div>
            </form>
        </Form>
    );
}
