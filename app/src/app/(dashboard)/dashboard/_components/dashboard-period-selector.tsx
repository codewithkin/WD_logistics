"use client";

import { PeriodSelector } from "@/components/ui/period-selector";

export function DashboardPeriodSelector() {
    return (
        <PeriodSelector
            useUrlParams={true}
            defaultPreset="1m"
            className="flex-shrink-0"
        />
    );
}
