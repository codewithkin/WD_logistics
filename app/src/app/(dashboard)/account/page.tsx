import { requireAuth } from "@/lib/session";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm } from "./_components/change-password-form";
import { AccountInfoCard } from "./_components/account-info-card";

export default async function AccountPage() {
    const session = await requireAuth();

    return (
        <div className="space-y-6">
            <PageHeader
                title="Account Settings"
                description="Manage your account and security settings"
            />

            <div className="grid gap-6 md:grid-cols-2">
                <AccountInfoCard
                    name={session.user.name}
                    email={session.user.email}
                    role={session.role}
                />

                <Card>
                    <CardHeader>
                        <CardTitle>Change Password</CardTitle>
                        <CardDescription>
                            Update your password to keep your account secure
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ChangePasswordForm />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
