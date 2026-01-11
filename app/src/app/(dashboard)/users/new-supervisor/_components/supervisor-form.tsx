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
    Alert,
    AlertDescription,
    AlertTitle,
} from "@/components/ui/alert";
import { Loader2, Mail, Copy, Check } from "lucide-react";
import { createSupervisor } from "../../actions";
import { toast } from "sonner";

const supervisorSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email address"),
});

type SupervisorFormData = z.infer<typeof supervisorSchema>;

interface CreatedCredentials {
    email: string;
    password: string;
}

export function CreateSupervisorForm() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [credentials, setCredentials] = useState<CreatedCredentials | null>(null);
    const [copied, setCopied] = useState(false);

    const form = useForm<SupervisorFormData>({
        resolver: zodResolver(supervisorSchema),
        defaultValues: {
            name: "",
            email: "",
        },
    });

    const onSubmit = async (data: SupervisorFormData) => {
        setIsLoading(true);
        try {
            const result = await createSupervisor(data);

            if (result.success) {
                if (result.warning && result.credentials) {
                    // Email failed, show credentials for manual sharing
                    toast.warning(result.warning);
                    setCredentials(result.credentials);
                } else {
                    toast.success("Supervisor created! Login credentials sent via email.");
                    router.push("/users");
                }
            } else {
                toast.error(result.error || "An error occurred");
            }
        } catch {
            toast.error("An error occurred");
        } finally {
            setIsLoading(false);
        }
    };

    const copyCredentials = () => {
        if (credentials) {
            const text = `Email: ${credentials.email}\nPassword: ${credentials.password}`;
            navigator.clipboard.writeText(text);
            setCopied(true);
            toast.success("Credentials copied to clipboard");
            setTimeout(() => setCopied(false), 2000);
        }
    };

    if (credentials) {
        return (
            <Card>
                <CardContent className="pt-6">
                    <Alert variant="default" className="mb-4 border-yellow-500 bg-yellow-50">
                        <Mail className="h-4 w-4" />
                        <AlertTitle>Email delivery failed</AlertTitle>
                        <AlertDescription>
                            The supervisor account was created, but the email could not be sent.
                            Please share these credentials manually:
                        </AlertDescription>
                    </Alert>

                    <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                        <p><strong>Email:</strong> {credentials.email}</p>
                        <p><strong>Password:</strong> {credentials.password}</p>
                    </div>
                </CardContent>
                <CardFooter className="flex justify-end gap-2">
                    <Button variant="outline" onClick={copyCredentials}>
                        {copied ? (
                            <>
                                <Check className="mr-2 h-4 w-4" />
                                Copied!
                            </>
                        ) : (
                            <>
                                <Copy className="mr-2 h-4 w-4" />
                                Copy Credentials
                            </>
                        )}
                    </Button>
                    <Button onClick={() => router.push("/users")}>
                        Done
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
                <Card>
                    <CardContent className="grid gap-6 pt-6">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Full Name</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="John Doe"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="email"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Email Address</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="email"
                                            placeholder="supervisor@wdlogistics.com"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormDescription>
                                        A random password will be generated and sent to this email address.
                                    </FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <Alert>
                            <Mail className="h-4 w-4" />
                            <AlertTitle>How it works</AlertTitle>
                            <AlertDescription>
                                <ul className="list-disc list-inside mt-2 space-y-1 text-sm">
                                    <li>A secure random password will be generated automatically</li>
                                    <li>Login credentials will be sent to the supervisor&apos;s email</li>
                                    <li>They can change their password after first login</li>
                                </ul>
                            </AlertDescription>
                        </Alert>
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
                            Create Supervisor
                        </Button>
                    </CardFooter>
                </Card>
            </form>
        </Form>
    );
}
