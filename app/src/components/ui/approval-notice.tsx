"use client";

/**
 * The banner and Reason box every edit form shows a non-admin.
 *
 * Two things had to be true for the approval flow to feel honest rather than
 * broken: the person filling the form has to know before they press Save that
 * it is a request, and the admin reviewing it has to be told why. Both live
 * here so no form can forget one of them.
 */

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";

export function ApprovalNotice({
  value,
  onChange,
  /** What is being changed, e.g. "truck". Used in the placeholder. */
  noun = "record",
  action = "change",
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  noun?: string;
  action?: "change" | "delete";
  error?: string;
}) {
  return (
    <div className="space-y-3 rounded-lg border border-amber-500/40 bg-amber-500/5 p-4">
      <p className="flex items-start gap-2 text-sm">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
        <span>
          {action === "delete" ? (
            <>
              This will be sent to an admin for approval. The {noun} stays
              where it is until they accept it.
            </>
          ) : (
            <>
              Your changes will be sent to an admin for approval. The {noun} is
              unchanged until they accept them.
            </>
          )}
        </span>
      </p>

      <div className="space-y-1">
        <Label htmlFor="approval-reason">
          Reason <span className="text-destructive">*</span>
        </Label>
        <Textarea
          id="approval-reason"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={
            action === "delete"
              ? `Why should this ${noun} be removed?`
              : `What are you changing, and why?`
          }
          rows={2}
          aria-invalid={Boolean(error)}
        />
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            The admin sees this when deciding.
          </p>
        )}
      </div>
    </div>
  );
}

/** The toast a form shows when a save became a request instead. */
export function isPendingApproval(
  result: unknown,
): result is { success: true; pendingApproval: true; message: string } {
  return Boolean(
    result &&
      typeof result === "object" &&
      "pendingApproval" in result &&
      (result as { pendingApproval?: boolean }).pendingApproval,
  );
}
