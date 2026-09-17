"use client";

import { useState } from "react";
import { Bell, BellRing, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
    DEFAULT_REMINDER_DAYS,
    MAX_REMINDER_DAYS,
    isValidReminderDay,
    normalizeReminderDays,
} from "@/lib/expiry-reminders";
import { cn } from "@/lib/utils";

const QUICK_ADD_DAYS = [90, 60, 30, 14, 7, 1];

interface ExpiryReminderPopoverProps {
    documentLabel: string;
    value: number[];
    onChange: (days: number[]) => void;
    disabled?: boolean;
}

function describeDays(day: number) {
    return `${day} day${day === 1 ? "" : "s"} before`;
}

export function ExpiryReminderPopover({ documentLabel, value, onChange, disabled }: ExpiryReminderPopoverProps) {
    const [open, setOpen] = useState(false);
    const [input, setInput] = useState("");
    const [error, setError] = useState<string | null>(null);

    const days = normalizeReminderDays(value);
    const hasCustom = days.length > 0;

    const addDay = (day: number) => {
        if (!isValidReminderDay(day)) {
            setError(`Enter a whole number of days between 1 and ${MAX_REMINDER_DAYS}`);
            return;
        }
        if (days.includes(day)) {
            setError(`You already have a reminder ${describeDays(day)}`);
            return;
        }
        onChange(normalizeReminderDays([...days, day]));
        setInput("");
        setError(null);
    };

    const removeDay = (day: number) => {
        onChange(days.filter((d) => d !== day));
        setError(null);
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={disabled}
                    className={cn(
                        "h-6 -my-1 gap-1.5 px-2 text-xs",
                        hasCustom ? "text-primary hover:text-primary" : "text-muted-foreground"
                    )}
                    aria-label={`Reminders for ${documentLabel}`}
                >
                    {hasCustom ? <BellRing className="h-3.5 w-3.5" /> : <Bell className="h-3.5 w-3.5" />}
                    {hasCustom ? (
                        <>
                            Reminders
                            <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
                                {days.length}
                            </span>
                        </>
                    ) : (
                        "Reminders"
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80 p-0">
                <div className="border-b p-4">
                    <p className="text-sm font-semibold">{documentLabel} reminders</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                        Get reminded this many days before it expires. Add as many as you need.
                    </p>
                </div>

                <div className="space-y-3 p-4">
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            min={1}
                            max={MAX_REMINDER_DAYS}
                            step={1}
                            inputMode="numeric"
                            placeholder="Days before expiry"
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                                setError(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    addDay(Number(input));
                                }
                            }}
                            className="h-9"
                        />
                        <Button type="button" size="sm" className="h-9" onClick={() => addDay(Number(input))} disabled={!input}>
                            <Plus className="mr-1 h-4 w-4" />
                            Add
                        </Button>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                        {QUICK_ADD_DAYS.map((day) => (
                            <button
                                key={day}
                                type="button"
                                onClick={() => addDay(day)}
                                disabled={days.includes(day)}
                                className="rounded-full border px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                +{day}d
                            </button>
                        ))}
                    </div>

                    {error && <p className="text-xs text-destructive">{error}</p>}

                    {hasCustom ? (
                        <ul className="space-y-1.5">
                            {days.map((day) => (
                                <li
                                    key={day}
                                    className="flex items-center justify-between rounded-md bg-primary/10 px-3 py-1.5 text-sm"
                                >
                                    <span className="flex items-center gap-2">
                                        <BellRing className="h-3.5 w-3.5 text-primary" />
                                        {describeDays(day)}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => removeDay(day)}
                                        className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-destructive"
                                        aria-label={`Remove reminder ${describeDays(day)}`}
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                            No custom reminders yet — the default schedule applies:{" "}
                            {DEFAULT_REMINDER_DAYS.join(", ")} days before.
                        </p>
                    )}
                </div>

                <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5">
                    <p className="text-[11px] leading-tight text-muted-foreground">
                        Also sent on the expiry day and weekly once expired.
                    </p>
                    {hasCustom && (
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            className="shrink-0 text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            Use default
                        </button>
                    )}
                </div>
            </PopoverContent>
        </Popover>
    );
}
