"use client";

/**
 * The organisation's push delivery log.
 *
 * "Push notifications aren't working" was impossible to act on, because a
 * missing key, a revoked subscription and a rejected payload all produced the
 * same silence. This is the answer to "for whom, and why not" — every attempt
 * with the push service's own reason attached.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import { getPushDeliveryLog } from "@/app/(dashboard)/_actions/notification-settings";

type LogRow = Awaited<ReturnType<typeof getPushDeliveryLog>>["deliveries"][number];

export function PushDeliveryLog() {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [subscriberCount, setSubscriberCount] = useState(0);
  const [failures, setFailures] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // `isLoading` starts true, so the fetch on mount doesn't have to set it —
  // setting state synchronously inside an effect causes a cascading render.
  const fetchLog = useCallback(async () => {
    try {
      const data = await getPushDeliveryLog();
      setRows(data.deliveries);
      setSubscriberCount(data.subscriberCount);
      setFailures(data.failuresLast7Days);
    } catch {
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchLog();
  }, [fetchLog]);

  // The refresh button, which may show the spinner again.
  const load = () => {
    setIsLoading(true);
    void fetchLog();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle>Notification delivery</CardTitle>
          <CardDescription>
            {subscriberCount} device{subscriberCount === 1 ? "" : "s"} subscribed
            across the organisation
            {failures > 0
              ? ` · ${failures} failed or skipped in the last 7 days`
              : ""}
            .
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading && rows.length === 0 ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No notifications have been sent yet. Ask someone to enable them from
            the user menu, then use Send test.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>To</TableHead>
                  <TableHead>Notification</TableHead>
                  <TableHead>Result</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {new Date(row.createdAt).toLocaleString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </TableCell>
                    <TableCell className="text-sm">{row.user}</TableCell>
                    <TableCell className="max-w-xs text-sm">
                      <p className="truncate">{row.title}</p>
                      {row.category && (
                        <p className="text-xs text-muted-foreground">
                          {row.category}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.status === "sent" ? (
                        <Badge variant="outline" className="gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                          Sent
                        </Badge>
                      ) : (
                        <div className="space-y-1">
                          <Badge variant="outline" className="gap-1">
                            <XCircle className="h-3 w-3 text-amber-600" />
                            {row.status === "skipped" ? "Skipped" : "Failed"}
                            {row.statusCode ? ` (${row.statusCode})` : ""}
                          </Badge>
                          {row.error && (
                            <p className="max-w-sm text-xs text-muted-foreground">
                              {row.error}
                            </p>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
