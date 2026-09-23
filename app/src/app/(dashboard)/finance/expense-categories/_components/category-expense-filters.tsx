"use client";

/**
 * The entity filters on a category's detail page.
 *
 * They live in the URL rather than component state, so a filtered view can be
 * bookmarked or pasted to someone else — "here is every fuel expense on
 * ABC 222 last quarter" is a link, not a set of instructions.
 */

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { EntityPicker } from "@/components/ui/entity-picker";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, X } from "lucide-react";
import type { EntityOption } from "@/lib/entity-picker/config";

export interface CategoryFilterLabels {
  truck?: EntityOption;
  trailer?: EntityOption;
  trip?: EntityOption;
  driver?: EntityOption;
  supplier?: EntityOption;
}

interface Props {
  labels: CategoryFilterLabels;
  /** Current values, read off the URL by the server page. */
  values: {
    truckId?: string;
    trailerId?: string;
    tripId?: string;
    driverId?: string;
    supplierId?: string;
    paid?: string;
  };
}

export function CategoryExpenseFilters({ labels, values }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // A narrower filter has fewer pages; keeping the old page number would
    // land the user on an empty table.
    params.delete("page");
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  const activeCount = [
    values.truckId,
    values.trailerId,
    values.tripId,
    values.driverId,
    values.supplierId,
    values.paid && values.paid !== "all" ? values.paid : undefined,
  ].filter(Boolean).length;

  const clearAll = () => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of [
      "truckId",
      "trailerId",
      "tripId",
      "driverId",
      "supplierId",
      "paid",
      "page",
    ]) {
      params.delete(key);
    }
    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium">Filter these expenses</h2>
        {isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : null}
        {activeCount > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={clearAll}
          >
            <X className="mr-1 h-3 w-3" />
            Clear {activeCount}
          </Button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Truck">
          <EntityPicker
            kind="truck"
            value={values.truckId ?? null}
            onChange={(id) => setParam("truckId", id)}
            initialSelected={labels.truck}
            clearable
            clearLabel="Any truck"
            placeholder="Any truck"
          />
        </Field>
        <Field label="Trailer">
          <EntityPicker
            kind="trailer"
            value={values.trailerId ?? null}
            onChange={(id) => setParam("trailerId", id)}
            initialSelected={labels.trailer}
            clearable
            clearLabel="Any trailer"
            placeholder="Any trailer"
          />
        </Field>
        <Field label="Trip">
          <EntityPicker
            kind="trip"
            value={values.tripId ?? null}
            onChange={(id) => setParam("tripId", id)}
            initialSelected={labels.trip}
            clearable
            clearLabel="Any trip"
            placeholder="Any trip"
          />
        </Field>
        <Field label="Driver">
          <EntityPicker
            kind="driver"
            value={values.driverId ?? null}
            onChange={(id) => setParam("driverId", id)}
            initialSelected={labels.driver}
            clearable
            clearLabel="Any driver"
            placeholder="Any driver"
          />
        </Field>
        <Field label="Supplier">
          <EntityPicker
            kind="supplier"
            value={values.supplierId ?? null}
            onChange={(id) => setParam("supplierId", id)}
            initialSelected={labels.supplier}
            clearable
            clearLabel="Any supplier"
            placeholder="Any supplier"
          />
        </Field>
        <Field label="Payment">
          <Select
            value={values.paid ?? "all"}
            onValueChange={(v) => setParam("paid", v === "all" ? null : v)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Paid and unpaid</SelectItem>
              <SelectItem value="paid">Paid only</SelectItem>
              <SelectItem value="unpaid">Unpaid only</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}
