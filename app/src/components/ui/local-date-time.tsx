"use client";

import { useEffect, useState } from "react";
import { format, formatDistanceToNow } from "date-fns";

interface LocalDateTimeProps {
    date: Date | string;
    /** A date-fns format string, or "relative" for "3 minutes ago". */
    pattern: string;
    className?: string;
}

/**
 * Formats a timestamp in the viewer's own timezone. Rendered only after
 * hydration: the production server runs in UTC, so formatting during SSR
 * would both show the wrong local time and mismatch the client's render.
 */
export function LocalDateTime({ date, pattern, className }: LocalDateTimeProps) {
    const [text, setText] = useState<string | null>(null);

    useEffect(() => {
        const value = new Date(date);
        setText(pattern === "relative" ? formatDistanceToNow(value, { addSuffix: true }) : format(value, pattern));
    }, [date, pattern]);

    return <span className={className}>{text ?? " "}</span>;
}
