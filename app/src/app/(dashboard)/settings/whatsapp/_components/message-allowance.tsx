/**
 * What is left of this month's WhatsApp assistant allowance.
 *
 * Sits next to the pairing because the two answers an admin wants are "is it
 * connected" and "is it still answering", and the second one has been
 * invisible until now — a month that quietly hit the cap looked identical to
 * a phone that had come unpaired.
 *
 * A server component: the number comes straight from the database on render,
 * so it cannot drift from what the agent enforces.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Gauge } from "lucide-react";
import { monthlyUsage } from "@/lib/assistant/usage";

export async function MessageAllowance({ organizationId }: { organizationId: string }) {
    const usage = await monthlyUsage(organizationId);
    const percent = Math.min(100, Math.round((usage.used / usage.limit) * 100));

    // Amber before it bites, red once it has. The threshold is deliberately
    // early: an admin who finds out at 200 has already had messages dropped.
    const tone = usage.blocked
        ? { bar: "bg-destructive", text: "text-destructive" }
        : percent >= 80
          ? { bar: "bg-amber-500", text: "text-amber-600 dark:text-amber-500" }
          : { bar: "bg-primary", text: "text-foreground" };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Gauge className="h-5 w-5" />
                    This month&apos;s messages
                </CardTitle>
                <CardDescription>
                    The assistant answers up to {usage.limit} messages a month. A message is one
                    question sent to it — the reply is not counted separately.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <p className={`text-2xl font-bold ${tone.text}`}>
                    {usage.used.toLocaleString()} of {usage.limit.toLocaleString()} used
                </p>

                <div
                    className="h-2 w-full overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuenow={usage.used}
                    aria-valuemin={0}
                    aria-valuemax={usage.limit}
                >
                    <div className={`h-full ${tone.bar}`} style={{ width: `${percent}%` }} />
                </div>

                <p className="text-sm text-muted-foreground">
                    {usage.blocked ? (
                        <>
                            <span className="font-medium text-destructive">
                                The assistant has stopped replying.
                            </span>{" "}
                            It answers nobody — not even an admin — until the count resets on{" "}
                            {usage.resetsOn}. Messages sent meanwhile get no reply and are not
                            queued.
                        </>
                    ) : (
                        <>
                            {usage.remaining.toLocaleString()} left. Resets {usage.resetsOn}.
                        </>
                    )}
                </p>
            </CardContent>
        </Card>
    );
}
