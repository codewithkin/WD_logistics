"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCallback } from "react";

interface ReportsTabsProps {
    value: string;
    children: React.ReactNode;
}

export function ReportsTabs({ value, children }: ReportsTabsProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const handleTabChange = useCallback((newTab: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("tab", newTab);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }, [router, pathname, searchParams]);

    return (
        <Tabs value={value} onValueChange={handleTabChange} className="space-y-6">
            {children}
        </Tabs>
    );
}

export function ReportsTabsList({ children }: { children: React.ReactNode }) {
    return <TabsList>{children}</TabsList>;
}

export function ReportsTabsTrigger({ value, children }: { value: string; children: React.ReactNode }) {
    return <TabsTrigger value={value}>{children}</TabsTrigger>;
}
