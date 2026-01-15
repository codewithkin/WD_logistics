"use client";

import * as React from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { format, subDays, subWeeks, subMonths, subYears, startOfDay, endOfDay } from "date-fns";
import { Calendar as CalendarIcon, Clock, ChevronDown, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DateRange } from "react-day-picker";

export interface PeriodValue {
    from: Date;
    to: Date;
    label: string;
    preset?: string;
}

interface PeriodSelectorProps {
    className?: string;
    value?: PeriodValue;
    onChange?: (period: PeriodValue) => void;
    /** If true, uses URL search params for state management */
    useUrlParams?: boolean;
    /** Default preset to use */
    defaultPreset?: string;
}

// Preset period options
const PRESET_PERIODS = [
    { value: "1d", label: "Last 24 Hours", days: 1 },
    { value: "7d", label: "Last 7 Days", days: 7 },
    { value: "1w", label: "Last Week", days: 7 },
    { value: "1m", label: "Last Month", months: 1 },
    { value: "3m", label: "Last 3 Months", months: 3 },
    { value: "6m", label: "Last 6 Months", months: 6 },
    { value: "1y", label: "Last Year", years: 1 },
    { value: "ytd", label: "Year to Date", ytd: true },
    { value: "all", label: "All Time", all: true },
] as const;

/**
 * Parses a period string like "1d", "2w", "3m", "1y" into a date range
 * Format: <number><unit>
 * Units: d (days), w (weeks), m (months), y (years)
 * Special: ytd (year to date), all (all time)
 */
export function parsePeriodString(periodStr: string): PeriodValue | null {
    const now = new Date();
    const to = endOfDay(now);

    // Handle special cases
    if (periodStr === "ytd") {
        return {
            from: startOfDay(new Date(now.getFullYear(), 0, 1)),
            to,
            label: "Year to Date",
            preset: "ytd",
        };
    }

    if (periodStr === "all") {
        return {
            from: new Date(2000, 0, 1), // Far past date
            to,
            label: "All Time",
            preset: "all",
        };
    }

    // Parse numeric format: <number><unit>
    const match = periodStr.match(/^(\d+)(d|w|m|y)$/);
    if (!match) return null;

    const [, numStr, unit] = match;
    const num = parseInt(numStr, 10);

    let from: Date;
    let label: string;

    switch (unit) {
        case "d":
            from = startOfDay(subDays(now, num));
            label = num === 1 ? "Last 24 Hours" : `Last ${num} Days`;
            break;
        case "w":
            from = startOfDay(subWeeks(now, num));
            label = num === 1 ? "Last Week" : `Last ${num} Weeks`;
            break;
        case "m":
            from = startOfDay(subMonths(now, num));
            label = num === 1 ? "Last Month" : `Last ${num} Months`;
            break;
        case "y":
            from = startOfDay(subYears(now, num));
            label = num === 1 ? "Last Year" : `Last ${num} Years`;
            break;
        default:
            return null;
    }

    return { from, to, label, preset: periodStr };
}

/**
 * Converts a preset value to a PeriodValue
 */
export function presetToPeriod(preset: string): PeriodValue | null {
    const presetConfig = PRESET_PERIODS.find((p) => p.value === preset);
    if (presetConfig) {
        return parsePeriodString(preset);
    }
    // Try parsing as custom period
    return parsePeriodString(preset);
}

/**
 * Gets the date range from URL search params
 */
export function getPeriodFromParams(searchParams: URLSearchParams): PeriodValue | null {
    const period = searchParams.get("period");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (period) {
        return parsePeriodString(period);
    }

    if (from && to) {
        return {
            from: new Date(from),
            to: new Date(to),
            label: `${format(new Date(from), "MMM d, yyyy")} - ${format(new Date(to), "MMM d, yyyy")}`,
        };
    }

    return null;
}

export function PeriodSelector({
    className,
    value,
    onChange,
    useUrlParams = false,
    defaultPreset = "1m",
}: PeriodSelectorProps) {
    return (
        <Suspense fallback={
            <Button variant="outline" className={cn("min-w-[180px] justify-between", className)} disabled>
                <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="truncate">Loading...</span>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
        }>
            <PeriodSelectorInner
                className={className}
                value={value}
                onChange={onChange}
                useUrlParams={useUrlParams}
                defaultPreset={defaultPreset}
            />
        </Suspense>
    );
}

function PeriodSelectorInner({
    className,
    value,
    onChange,
    useUrlParams = false,
    defaultPreset = "1m",
}: PeriodSelectorProps) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [isCustomOpen, setIsCustomOpen] = React.useState(false);
    const [customPeriod, setCustomPeriod] = React.useState("");
    const [customError, setCustomError] = React.useState("");
    const [dateRange, setDateRange] = React.useState<DateRange | undefined>();

    // Get current period from URL params or props
    const currentPeriod = React.useMemo(() => {
        if (useUrlParams) {
            const fromParams = getPeriodFromParams(searchParams);
            if (fromParams) return fromParams;
        }
        if (value) return value;
        return presetToPeriod(defaultPreset);
    }, [useUrlParams, searchParams, value, defaultPreset]);

    // Update URL params when period changes
    const updatePeriod = React.useCallback(
        (period: PeriodValue) => {
            if (onChange) {
                onChange(period);
            }

            if (useUrlParams) {
                const params = new URLSearchParams(searchParams.toString());

                if (period.preset) {
                    params.set("period", period.preset);
                    params.delete("from");
                    params.delete("to");
                } else {
                    params.delete("period");
                    params.set("from", period.from.toISOString());
                    params.set("to", period.to.toISOString());
                }

                router.push(`${pathname}?${params.toString()}`, { scroll: false });
            }
        },
        [onChange, useUrlParams, searchParams, pathname, router]
    );

    // Handle preset selection
    const handlePresetSelect = (preset: string) => {
        const period = presetToPeriod(preset);
        if (period) {
            updatePeriod(period);
        }
    };

    // Handle custom period input
    const handleCustomPeriodSubmit = () => {
        setCustomError("");
        const period = parsePeriodString(customPeriod.toLowerCase().trim());
        if (period) {
            updatePeriod(period);
            setCustomPeriod("");
            setIsCustomOpen(false);
        } else {
            setCustomError("Invalid format. Use: 1d, 2w, 3m, 1y, etc.");
        }
    };

    // Handle custom date range selection
    const handleDateRangeSelect = (range: DateRange | undefined) => {
        setDateRange(range);
        if (range?.from && range?.to) {
            updatePeriod({
                from: startOfDay(range.from),
                to: endOfDay(range.to),
                label: `${format(range.from, "MMM d, yyyy")} - ${format(range.to, "MMM d, yyyy")}`,
            });
            setIsCustomOpen(false);
        }
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="min-w-[180px] justify-between">
                        <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span className="truncate">{currentPeriod?.label || "Select Period"}</span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-[220px]">
                    {/* Preset options */}
                    {PRESET_PERIODS.map((preset) => (
                        <DropdownMenuItem
                            key={preset.value}
                            onClick={() => handlePresetSelect(preset.value)}
                            className="flex items-center justify-between"
                        >
                            {preset.label}
                            {currentPeriod?.preset === preset.value && (
                                <Check className="h-4 w-4 text-primary" />
                            )}
                        </DropdownMenuItem>
                    ))}

                    <DropdownMenuSeparator />

                    {/* Custom period option */}
                    <DropdownMenuItem
                        onClick={(e) => {
                            e.preventDefault();
                            setIsCustomOpen(true);
                        }}
                    >
                        Custom Period...
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {/* Custom Period Popover */}
            <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
                <PopoverTrigger asChild>
                    <span className="sr-only">Custom period</span>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-4" align="start">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="custom-period" className="text-sm font-medium">
                                Quick Period Format
                            </Label>
                            <p className="text-xs text-muted-foreground">
                                Enter a period like: 1d, 2w, 3m, 1y, 2y
                            </p>
                            <div className="flex gap-2">
                                <Input
                                    id="custom-period"
                                    placeholder="e.g., 6m, 2y"
                                    value={customPeriod}
                                    onChange={(e) => {
                                        setCustomPeriod(e.target.value);
                                        setCustomError("");
                                    }}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            handleCustomPeriodSubmit();
                                        }
                                    }}
                                    className="w-24"
                                />
                                <Button size="sm" onClick={handleCustomPeriodSubmit}>
                                    Apply
                                </Button>
                            </div>
                            {customError && (
                                <p className="text-xs text-destructive">{customError}</p>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">
                                    Or select dates
                                </span>
                            </div>
                        </div>

                        <div>
                            <Calendar
                                mode="range"
                                selected={dateRange}
                                onSelect={handleDateRangeSelect}
                                numberOfMonths={2}
                                className="rounded-md border"
                            />
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

// Export period utilities for server-side use
export { PRESET_PERIODS };
