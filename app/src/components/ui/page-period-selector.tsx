"use client";

import { PeriodSelector } from "@/components/ui/period-selector";

interface PagePeriodSelectorProps {
    defaultPreset?: string;
}

export function PagePeriodSelector({ defaultPreset = "1m" }: PagePeriodSelectorProps) {
    return (
        <PeriodSelector
            useUrlParams={true}
            defaultPreset={defaultPreset}
            className="flex-shrink-0"
        />
    );
}
