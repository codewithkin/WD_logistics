"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Loader2 } from "lucide-react";
import { ROLE_LABELS } from "@/lib/types";
import { toast } from "sonner";

const inviteSchema = z.object({
    email: z.string().email("Invalid email address"),
    name: z.string().optional(),
    role: z.enum(["admin", "supervisor", "staff"]),
});

type InviteFormData = z.infer<typeof inviteSchema>;

export function InviteUserForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);

    const form = useForm<InviteFormData>({
        resolver: zodResolver(inviteSchema),
        defaultValues: {
            email: "",
            name: "",
            role: "staff",
        },
    });

    const onSubmit = async (data: InviteFormData) => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/users/invite", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (result.success) {
                if (result.warning) {
                    toast.warning(result.warning);
                    // Show credentials in console for manual sharing
                    console.log("User credentials:", result.credentials);
                } else {
                    toast.success(result.message || "User added to organization");
                }
                router.push("/users");
                router.refresh();
            } else {
                toast.error(result.error || "An error occurred");
            }
        } catch (error) {
            console.error("Failed to invite user:", error);
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
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="user@example.com"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        If the user doesn&apos;t have an account, one will be created and credentials sent to their email.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Name (Optional)</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="John Doe"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        Used when creating a new account. If left empty, the email prefix will be used.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="role"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Role</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a role" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                                                <SelectItem key={value} value={value}>
                                                    {label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormDescription>
                                        <strong>Admin:</strong> Full access to all features
                                        <br />
                                        <strong>Supervisor:</strong> Can manage operations but cannot delete
                                        <br />
                                        <strong>Staff:</strong> View access and can request edits
                                    </FormDescription>
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
                            Add User
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
