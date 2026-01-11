"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
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
import { Loader2, Mail, Copy, Check, Plus } from "lucide-react";
import { createSupervisor } from "../actions";
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

interface CreateSupervisorDialogProps {
    trigger?: React.ReactNode;
}

export function CreateSupervisorDialog({ trigger }: CreateSupervisorDialogProps) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
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
                    handleClose();
                    router.refresh();
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

    const handleClose = () => {
        setOpen(false);
        setCredentials(null);
        setCopied(false);
        form.reset();
    };

    const handleDone = () => {
        handleClose();
        router.refresh();
    };

    return (
        <Dialog open={open} onOpenChange={(isOpen) => {
            if (!isOpen) handleClose();
            else setOpen(true);
        }}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="secondary">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Supervisor
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                {credentials ? (
                    <>
                        <DialogHeader>
                            <DialogTitle>Supervisor Created</DialogTitle>
                            <DialogDescription>
                                Please share these credentials manually with the supervisor.
                            </DialogDescription>
                        </DialogHeader>

                        <Alert variant="default" className="border-yellow-500 bg-yellow-50 dark:bg-yellow-950">
                            <Mail className="h-4 w-4" />
                            <AlertTitle>Email delivery failed</AlertTitle>
                            <AlertDescription>
                                The account was created, but the email could not be sent.
                            </AlertDescription>
                        </Alert>

                        <div className="bg-muted p-4 rounded-lg space-y-2 font-mono text-sm">
                            <p><strong>Email:</strong> {credentials.email}</p>
                            <p><strong>Password:</strong> {credentials.password}</p>
                        </div>

                        <DialogFooter>
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
                            <Button onClick={handleDone}>
                                Done
                            </Button>
                        </DialogFooter>
                    </>
                ) : (
                    <>
                        <DialogHeader>
                            <DialogTitle>Add Supervisor</DialogTitle>
                            <DialogDescription>
                                Create a new supervisor account. They will receive login credentials via email.
                            </DialogDescription>
                        </DialogHeader>

                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                                A random password will be generated and sent to this email.
                                            </FormDescription>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter className="pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleClose}
                                        disabled={isLoading}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" disabled={isLoading}>
                                        {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Create Supervisor
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </>
                )}
            </DialogContent>
        </Dialog>
    );
}
