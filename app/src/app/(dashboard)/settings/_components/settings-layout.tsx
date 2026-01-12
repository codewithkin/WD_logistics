"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
    User,
    Settings as SettingsIcon,
    Bell,
    Shield,
    Users,
    CreditCard,
    Building2,
    Palette,
    Globe
} from "lucide-react";

interface SettingsLayoutProps {
    children: React.ReactNode;
}

const settingsNav = [
    {
        title: "ACCOUNT",
        items: [
            { id: "general", label: "General", icon: SettingsIcon },
            { id: "profile", label: "My Profile", icon: User },
            { id: "notifications", label: "Notifications", icon: Bell },
            { id: "preferences", label: "Preferences", icon: Palette },
        ],
    },
    {
        title: "ORGANIZATION",
        items: [
            { id: "organization", label: "Organization", icon: Building2 },
            { id: "members", label: "Members", icon: Users },
            { id: "security", label: "Security", icon: Shield },
            { id: "billing", label: "Billing", icon: CreditCard },
        ],
    },
];

export function SettingsLayout({ children }: SettingsLayoutProps) {
    const [activeSection, setActiveSection] = useState("general");

    return (
        <div className="flex gap-6 h-[calc(100vh-12rem)]">
            {/* Sidebar */}
            <aside className="w-64 shrink-0 space-y-6 overflow-y-auto pr-4">
                {settingsNav.map((group) => (
                    <div key={group.title} className="space-y-2">
                        <h4 className="text-xs font-semibold text-muted-foreground px-3">
                            {group.title}
                        </h4>
                        <nav className="space-y-1">
                            {group.items.map((item) => {
                                const Icon = item.icon;
                                return (
                                    <button
                                        key={item.id}
                                        onClick={() => setActiveSection(item.id)}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors",
                                            activeSection === item.id
                                                ? "bg-primary/10 text-primary font-medium"
                                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                        )}
                                    >
                                        <Icon className="h-4 w-4" />
                                        {item.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                ))}
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
        </div>
    );
}
