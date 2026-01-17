"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Shield } from "lucide-react";

interface AccountInfoCardProps {
    name: string;
    email: string;
    role: string;
}

const roleLabels: Record<string, string> = {
    admin: "Administrator",
    supervisor: "Supervisor",
    staff: "Staff Member",
};

const roleColors: Record<string, string> = {
    admin: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    supervisor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
    staff: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export function AccountInfoCard({ name, email, role }: AccountInfoCardProps) {
    return (
        <Card>
            <CardHeader>
                <CardTitle>Account Information</CardTitle>
                <CardDescription>
                    Your account details
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{name}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Email</p>
                        <p className="font-medium">{email}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Role</p>
                        <Badge className={roleColors[role] || "bg-gray-100 text-gray-800"}>
                            {roleLabels[role] || role}
                        </Badge>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
