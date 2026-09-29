"use client";

import { ReactNode, Suspense } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsLayoutProps {
    children: {
        general: ReactNode;
        notifications: ReactNode;
        organisation: ReactNode;
        members: ReactNode;
    };
}

const TABS = ["general", "notifications", "organisation", "members"] as const;

export function SettingsLayout(props: SettingsLayoutProps) {
    // The tab lives in the URL, as it does on Reports. It used to be local
    // state starting at "general", which meant /settings?tab=notifications
    // opened on General — so a notification that deep-linked here landed on
    // the wrong panel, a link to a tab could not be shared, and a reload lost
    // your place.
    return (
        <Suspense fallback={<SettingsTabs {...props} tab="general" />}>
            <SettingsLayoutInner {...props} />
        </Suspense>
    );
}

function SettingsLayoutInner(props: SettingsLayoutProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const requested = searchParams.get("tab");
    const tab = TABS.includes(requested as (typeof TABS)[number])
        ? (requested as (typeof TABS)[number])
        : "general";

    const setTab = (next: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", next);
        // Replace rather than push: flicking between tabs should not fill the
        // back button with settings panels.
        router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    };

    return <SettingsTabs {...props} tab={tab} onTabChange={setTab} />;
}

function SettingsTabs({
    children,
    tab,
    onTabChange,
}: SettingsLayoutProps & { tab: string; onTabChange?: (next: string) => void }) {
    const activeTab = tab;
    const setActiveTab = onTabChange ?? (() => {});

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
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:hover:bg-transparent px-4 pb-3 pt-2"
                    >
                        General
                    </TabsTrigger>
                    <TabsTrigger
                        value="notifications"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:hover:bg-transparent px-4 pb-3 pt-2"
                    >
                        Notifications
                    </TabsTrigger>
                    <TabsTrigger
                        value="organisation"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:hover:bg-transparent px-4 pb-3 pt-2"
                    >
                        Organisation
                    </TabsTrigger>
                    <TabsTrigger
                        value="members"
                        className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:hover:bg-transparent px-4 pb-3 pt-2"
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
