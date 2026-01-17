"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { navigationSections, NavItem, NavSection } from "@/config/navigation";
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
    showExpenses?: boolean;
}

export function Sidebar({ pendingEditRequests = 0, showExpenses = false }: SidebarProps) {
    const pathname = usePathname();
    const { role } = useSession();
    const [openMenus, setOpenMenus] = useState<string[]>([]);

    // Check if a path is active (exact match for dashboard, otherwise starts with)
    const isActive = (href: string) => {
        if (href === "/dashboard") {
            return pathname === "/dashboard";
        }
        return pathname.startsWith(href);
    };

    // Check if any child is active
    const hasActiveChild = (item: NavItem): boolean => {
        if (!item.children) return false;
        return item.children.some((child) => isActive(child.href));
    };

    // Auto-open menus that have active children
    useEffect(() => {
        const menusToOpen: string[] = [];
        navigationSections.forEach((section) => {
            section.items.forEach((item) => {
                if (item.children && hasActiveChild(item)) {
                    menusToOpen.push(item.title);
                }
            });
        });
        if (menusToOpen.length > 0) {
            setOpenMenus((prev) => [...new Set([...prev, ...menusToOpen])]);
        }
    }, [pathname]);

    const toggleMenu = (title: string) => {
        setOpenMenus((prev) =>
            prev.includes(title)
                ? prev.filter((t) => t !== title)
                : [...prev, title]
        );
    };

    // Filter sections based on role and showExpenses
    const shouldShowItem = (item: NavItem): boolean => {
        // Check basic role permission
        if (!item.roles.includes(role)) {
            // Special case: if requiresShowExpenses and SHOW_EXPENSES is enabled, show to supervisor
            if (item.requiresShowExpenses && role === "supervisor" && showExpenses) {
                return true;
            }
            return false;
        }
        return true;
    };

    const filteredSections = navigationSections
        .map((section) => ({
            ...section,
            items: section.items.filter((item) => shouldShowItem(item)),
        }))
        .filter((section) => section.items.length > 0);

    const renderNavItem = (item: NavItem) => {
        // Filter children by role and showExpenses
        const filteredChildren = item.children?.filter((child) =>
            shouldShowItem(child)
        );

        const hasChildren = filteredChildren && filteredChildren.length > 0;
        const isOpen = openMenus.includes(item.title);
        const Icon = item.icon;
        const itemActive = isActive(item.href);
        const childActive = hasActiveChild(item);
        const isParentActive = hasChildren && childActive;

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
                                "w-full justify-between px-3 py-2 h-10 transition-all duration-300 hover:scale-[1.02]",
                                isParentActive && "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:text-white shadow-lg shadow-green-500/25"
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
                    <CollapsibleContent className="pl-6 space-y-1 mt-1">
                        {filteredChildren.map((child) => {
                            const ChildIcon = child.icon;
                            const childIsActive = isActive(child.href);
                            return (
                                <Link key={child.href} href={child.href}>
                                    <Button
                                        variant="ghost"
                                        className={cn(
                                            "w-full justify-start px-3 py-2 h-9 transition-all duration-300 hover:scale-[1.02] hover:translate-x-1",
                                            childIsActive && "bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 font-medium shadow-sm"
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
                        "w-full justify-start px-3 py-2 h-10 transition-all duration-300 hover:scale-[1.02]",
                        itemActive && "bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 hover:text-white font-medium shadow-lg shadow-green-500/25"
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

    const renderSection = (section: NavSection, index: number) => {
        const filteredItems = section.items.filter((item) =>
            item.roles.includes(role)
        );

        if (filteredItems.length === 0) return null;

        return (
            <div key={section.label} className={cn(index > 0 && "mt-6")}>
                <h4 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.label}
                </h4>
                <div className="space-y-1">
                    {filteredItems.map(renderNavItem)}
                </div>
            </div>
        );
    };

    return (
        <aside className="w-64 border-r bg-card h-screen sticky top-0 flex flex-col">
            {/* Logo */}
            <div className="p-4 border-b">
                <Link href="/dashboard" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-green-500/25 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                        <span className="text-white font-bold text-sm">WD</span>
                    </div>
                    <span className="font-bold text-lg group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors duration-300">WD Logistics</span>
                </Link>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto p-3">
                {filteredSections.map((section, index) => renderSection(section, index))}
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
