"use client";

/**
 * The before/after view an admin decides on.
 *
 * The old screen showed the raw `proposedData` JSON — which was always `{}`,
 * because nothing ever filled it in. This shows one row per field that
 * actually changed, with the value as it was, the value now, and the value
 * being asked for.
 *
 * The middle column only appears when the record has moved on since the
 * request was raised. That case is real: two people edit the same truck, the
 * second request was written against a snapshot that is now stale, and
 * approving it would quietly undo the first change. The admin sees exactly
 * which fields, and decides.
 */

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, Trash2 } from "lucide-react";
import { getEditRequestDiff, type DiffRow } from "../actions";

function formatValue(value: unknown, isMoney: boolean): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.length === 0 ? "none" : `${value.length} linked`;
  }
  if (isMoney && typeof value === "number") {
    return `$${value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  if (typeof value === "string") {
    // ISO dates come back from the JSON round-trip as strings.
    const asDate = /^\d{4}-\d{2}-\d{2}T/.test(value) ? new Date(value) : null;
    if (asDate && !Number.isNaN(asDate.getTime())) {
      return asDate.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
    return value.length > 80 ? `${value.slice(0, 80)}…` : value;
  }
  return String(value);
}

export function EditRequestDiff({
  requestId,
  action,
  entityLabel,
}: {
  requestId: string;
  action: string;
  entityLabel: string;
}) {
  const [rows, setRows] = useState<DiffRow[] | null>(null);
  const [conflicted, setConflicted] = useState(false);
  const [entityMissing, setEntityMissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEditRequestDiff(requestId)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error ?? "Could not load this request.");
          return;
        }
        setRows(result.rows ?? []);
        setConflicted(Boolean(result.conflicted));
        setEntityMissing(Boolean(result.entityMissing));
      })
      .catch(() => {
        if (!cancelled) setError("Could not load this request.");
      });
    return () => {
      cancelled = true;
    };
  }, [requestId]);

  if (error) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (rows === null) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading the change…
      </div>
    );
  }

  if (entityMissing) {
    return (
      <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <p>
          The record this request points at no longer exists. Turn the request
          down — there is nothing left to change.
        </p>
      </div>
    );
  }

  if (action === "delete") {
    return (
      <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
        <Trash2 className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
        <div>
          <p className="font-medium">Delete {entityLabel}</p>
          <p className="text-muted-foreground">
            Approving removes the record and anything that cascades from it.
            This cannot be undone.
          </p>
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">
        Nothing in this request differs from the record as it stands. Approving
        it would change nothing.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {conflicted && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p>
            This record changed after the request was raised. The rows marked
            below differ from what the requester saw — approving will overwrite
            them with the proposed values.
          </p>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-xs text-muted-foreground">
              <th className="py-2 pr-3 font-medium">Field</th>
              <th className="py-2 pr-3 font-medium">Was</th>
              {conflicted && (
                <th className="py-2 pr-3 font-medium">Now</th>
              )}
              <th className="py-2 font-medium">Proposed</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {rows.map((row) => (
              <tr key={row.field} className={row.changed ? "" : "opacity-60"}>
                <td className="py-2 pr-3 align-top">
                  <span className="font-medium">{row.label}</span>
                  {row.conflicted && (
                    <Badge
                      variant="outline"
                      className="ml-2 border-amber-500/50 text-[10px] text-amber-700"
                    >
                      changed since
                    </Badge>
                  )}
                </td>
                <td className="py-2 pr-3 align-top text-muted-foreground">
                  {formatValue(row.original, row.isMoney)}
                </td>
                {conflicted && (
                  <td className="py-2 pr-3 align-top text-muted-foreground">
                    {formatValue(row.current, row.isMoney)}
                  </td>
                )}
                <td className="py-2 align-top">
                  {row.changed ? (
                    <span className="font-medium text-primary">
                      {formatValue(row.proposed, row.isMoney)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">
                      {formatValue(row.proposed, row.isMoney)}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
