"use client";

import { useState, ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsLayoutProps {
    children: {
        general: ReactNode;
        notifications: ReactNode;
        organisation: ReactNode;
        members: ReactNode;
    };
}

export function SettingsLayout({ children }: SettingsLayoutProps) {
    const [activeTab, setActiveTab] = useState("general");

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-muted-foreground">
                    Manage your account settings and preferences.
                </p>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="w-full justify-start border-b bg-transparent h-auto p-0 rounded-none">
                    <TabsTrigger
                        value="general"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                    >
                        General
                    </TabsTrigger>
                    <TabsTrigger
                        value="notifications"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                    >
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger
                        value="organisation"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                    >
                        Organisation
                    </TabsTrigger>
                    <TabsTrigger
                        value="members"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-4 pb-3 pt-2"
                    >
                        Members
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="general" className="mt-6">
                    {children.general}
                </TabsContent>
                <TabsContent value="notifications" className="mt-6">
                    {children.notifications}
                </TabsContent>
                <TabsContent value="organisation" className="mt-6">
                    {children.organisation}
                </TabsContent>
                <TabsContent value="members" className="mt-6">
                    {children.members}
                </TabsContent>
            </Tabs>
        </div>
    );
}
