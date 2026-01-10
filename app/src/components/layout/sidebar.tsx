"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navigationConfig, NavItem } from "@/config/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/components/providers/session-provider";
import { ChevronDown, ChevronRight } from "lucide-react";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface SidebarProps {
    pendingEditRequests?: number;
}

export function Sidebar({ pendingEditRequests = 0 }: SidebarProps) {
    const pathname = usePathname();
    const { role } = useSession();
    const [openMenus, setOpenMenus] = useState<string[]>([]);

    // Filter navigation based on role
    const filteredNav = navigationConfig.filter((item) =>
        item.roles.includes(role)
    );

    const toggleMenu = (title: string) => {
        setOpenMenus((prev) =>
            prev.includes(title)
                ? prev.filter((t) => t !== title)
                : [...prev, title]
        );
    };

    const isActive = (href: string) => pathname.startsWith(href);

    const renderNavItem = (item: NavItem) => {
        // Filter children by role
        const filteredChildren = item.children?.filter((child) =>
            child.roles.includes(role)
        );

        const hasChildren = filteredChildren && filteredChildren.length > 0;
        const isOpen = openMenus.includes(item.title);
        const Icon = item.icon;

        if (hasChildren) {
            return (
                <Collapsible
                    key={item.title}
                    open={isOpen}
                    onOpenChange={() => toggleMenu(item.title)}
                >
                    <CollapsibleTrigger asChild>
                        <Button
                            variant="ghost"
                            className={cn(
                                "w-full justify-between px-3 py-2 h-10",
                                isActive(item.href) && "bg-accent"
                            )}
                        >
                            <span className="flex items-center gap-3">
                                <Icon className="h-4 w-4" />
                                {item.title}
                            </span>
                            {isOpen ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                        </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pl-6 space-y-1">
                        {filteredChildren.map((child) => {
                            const ChildIcon = child.icon;
                            return (
                                <Link key={child.href} href={child.href}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start px-3 py-2 h-9",
                                            isActive(child.href) && "bg-accent font-medium"
                                        )}
                                    >
                                        <ChildIcon className="h-4 w-4 mr-3" />
                                        {child.title}
                                    </Button>
                                </Link>
                            );
                        })}
                    </CollapsibleContent>
                </Collapsible>
            );
        }

        return (
            <Link key={item.href} href={item.href}>
                <Button
                    variant="ghost"
                    className={cn(
                        "w-full justify-start px-3 py-2 h-10",
                        isActive(item.href) && "bg-accent font-medium"
                    )}
                >
                    <Icon className="h-4 w-4 mr-3" />
                    {item.title}
                    {item.badge === "pending" && pendingEditRequests > 0 && (role === "admin" || role === "supervisor") && (
                        <Badge variant="destructive" className="ml-auto">
                            {pendingEditRequests}
                        </Badge>
                    )}
                </Button>
            </Link>
        );
    };

    return (
        <aside className="w-64 border-r bg-card h-screen sticky top-0 flex flex-col">
            {/* Logo */}
            <div className="p-4 border-b">
                <Link href="/dashboard" className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                        <span className="text-white font-bold text-sm">WD</span>
                    </div>
                    <span className="font-bold text-lg">WD Logistics</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
                {filteredNav.map(renderNavItem)}
            </nav>

            {/* User Role Badge */}
            <div className="p-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Role:</span>
                    <Badge variant="outline" className="capitalize">
                        {role}
                    </Badge>
                </div>
            </div>
        </aside>
    );
}
