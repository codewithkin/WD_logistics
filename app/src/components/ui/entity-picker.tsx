"use client";

/**
 * EntityPicker — the replacement for every "pick a related record" <Select>.
 *
 * A native select can only show what the page happened to preload, gives no
 * search, no filters and no context beyond a single line of text. This opens a
 * dialog that searches the whole organisation, filters by the dimensions that
 * matter for that entity, and pages ten records at a time. Each row carries a
 * second line and a status pill, so the user picks the right truck rather than
 * the first registration that looks familiar.
 *
 * Layout is mobile-first: the dialog is a full-height sheet under `sm`, and a
 * centred panel above it. Rows are 44px+ tap targets throughout.
 */

import * as React from "react";
import {
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Container,
  FileText,
  Loader2,
  Package,
  Route,
  Search,
  SlidersHorizontal,
  Store,
  Tags,
  Truck as TruckIcon,
  User,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, type StatusType } from "@/components/ui/status-badge";
import { searchEntities } from "@/app/(dashboard)/_actions/entity-search";
import {
  ENTITY_CONFIG,
  ENTITY_PAGE_SIZE,
  type EntityKind,
  type EntityOption,
} from "@/lib/entity-picker/config";

const ICONS: Record<string, LucideIcon> = {
  Truck: TruckIcon,
  Container,
  User,
  Building2,
  Store,
  Users,
  Route,
  FileText,
  Tags,
  Package,
  Wallet,
  UserCog,
};

/** Maps a picker entity onto the StatusBadge config that fits it. */
const BADGE_TYPE: Partial<Record<EntityKind, StatusType>> = {
  truck: "truck",
  trailer: "trailer",
  driver: "driver",
  employee: "employee",
  customer: "customer",
  supplier: "customer",
  trip: "trip",
  invoice: "invoice",
};

export interface EntityPickerProps {
  kind: EntityKind;
  /** Selected record id, or null/undefined when nothing is chosen. */
  value?: string | null;
  onChange: (id: string | null) => void;
  /**
   * What to show on the trigger before the picker has loaded the record — the
   * label the parent already knows. Avoids a flash of "Select a truck…" when
   * editing an existing record.
   */
  initialLabel?: string;
  initialDescription?: string;
  /** Allows a "None" choice and a clear button. */
  clearable?: boolean;
  /** Label used for the clear option, e.g. "No customer". */
  clearLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  /** Restricts the result set, e.g. only this customer's invoices. */
  scope?: { key: string; value: string };
  /** Filters forced on every query and hidden from the user. */
  lockedFilters?: Record<string, string>;
  /**
   * Filters the dialog opens with. Unlike `lockedFilters` these stay visible
   * and the user can widen them — e.g. a trip form opens on active trucks but
   * lets you reach a truck that is currently in for repair.
   */
  defaultFilters?: Record<string, string>;
  className?: string;
  /** Rendered under the trigger; use for a hint about what the choice affects. */
  hint?: string;
  id?: string;
}

export function EntityPicker({
  kind,
  value,
  onChange,
  initialLabel,
  initialDescription,
  clearable = false,
  clearLabel,
  placeholder,
  disabled = false,
  scope,
  lockedFilters,
  defaultFilters,
  className,
  hint,
  id,
}: EntityPickerProps) {
  const config = ENTITY_CONFIG[kind];
  const Icon = ICONS[config.icon] ?? TruckIcon;

  const [open, setOpen] = React.useState(false);
  // The label of the current selection, so the trigger reads as a record and
  // not as an opaque cuid. Seeded from the parent, then kept up to date by
  // whatever the user picks.
  const [selected, setSelected] = React.useState<EntityOption | null>(
    value && initialLabel
      ? { id: value, label: initialLabel, description: initialDescription }
      : null,
  );

  // If the form resets or the parent swaps the value, drop a stale label
  // rather than showing the wrong record's name.
  React.useEffect(() => {
    if (!value) {
      setSelected(null);
    } else if (selected?.id !== value) {
      setSelected((prev) =>
        prev?.id === value
          ? prev
          : initialLabel
            ? { id: value, label: initialLabel, description: initialDescription }
            : null,
      );
    }
    // `selected` is intentionally excluded: this only reacts to the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, initialLabel, initialDescription]);

  const handlePick = (option: EntityOption | null) => {
    setSelected(option);
    onChange(option?.id ?? null);
    setOpen(false);
  };

  const triggerText =
    selected?.label ??
    (value ? "Loading…" : (placeholder ?? `Select a ${config.singular.toLowerCase()}`));

  return (
    <div className={cn("w-full", className)}>
      <div className="flex w-full items-center gap-2">
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => setOpen(true)}
          className={cn(
            "flex min-h-10 w-full items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-left text-sm shadow-xs transition-colors",
            "hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            !selected && "text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4 shrink-0 opacity-60" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">{triggerText}</span>
            {selected?.description ? (
              <span className="block truncate text-xs text-muted-foreground">
                {selected.description}
              </span>
            ) : null}
          </span>
          <Search className="h-4 w-4 shrink-0 opacity-50" />
        </button>
        {clearable && selected && !disabled ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => handlePick(null)}
            aria-label={`Clear ${config.singular.toLowerCase()}`}
          >
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </div>
      {hint ? (
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      ) : null}

      <EntityPickerDialog
        kind={kind}
        open={open}
        onOpenChange={setOpen}
        value={value ?? null}
        onPick={handlePick}
        clearable={clearable}
        clearLabel={clearLabel}
        scope={scope}
        lockedFilters={lockedFilters}
        defaultFilters={defaultFilters}
      />
    </div>
  );
}

interface DialogProps {
  kind: EntityKind;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string | null;
  onPick: (option: EntityOption | null) => void;
  clearable: boolean;
  clearLabel?: string;
  scope?: { key: string; value: string };
  lockedFilters?: Record<string, string>;
  defaultFilters?: Record<string, string>;
}

function EntityPickerDialog({
  kind,
  open,
  onOpenChange,
  value,
  onPick,
  clearable,
  clearLabel,
  scope,
  lockedFilters,
  defaultFilters,
}: DialogProps) {
  const config = ENTITY_CONFIG[kind];
  const badgeType = BADGE_TYPE[kind];

  const [rawQuery, setRawQuery] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [filters, setFilters] = React.useState<Record<string, string>>(
    defaultFilters ?? {},
  );
  const [sort, setSort] = React.useState(config.defaultSort);
  const [page, setPage] = React.useState(1);
  const [showFilters, setShowFilters] = React.useState(false);

  const [items, setItems] = React.useState<EntityOption[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Debounce typing so a search doesn't fire a query per keystroke.
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(rawQuery);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [rawQuery]);

  // Reset to a clean sheet each time the dialog opens, so a filter left over
  // from a previous pick doesn't hide the record the user is looking for now.
  React.useEffect(() => {
    if (open) {
      setRawQuery("");
      setQuery("");
      setFilters(defaultFilters ?? {});
      setSort(config.defaultSort);
      setPage(1);
      setShowFilters(false);
    }
    // `defaultFilters` is a literal at most call sites; comparing by identity
    // would re-run this on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, config.defaultSort]);

  const filterKey = JSON.stringify({ filters, lockedFilters });

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    searchEntities({
      kind,
      query: query || undefined,
      filters: { ...filters, ...lockedFilters },
      sort,
      page,
      scope,
      includeIds: value ? [value] : undefined,
    })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : "Could not load records.",
        );
        setItems([]);
        setTotal(0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `filterKey` stands in for the two filter objects.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, kind, query, filterKey, sort, page, value, scope?.key, scope?.value]);

  const pageCount = Math.max(1, Math.ceil(total / ENTITY_PAGE_SIZE));
  const visibleFilters = config.filters.filter(
    (f) => !(lockedFilters && f.key in lockedFilters),
  );
  const activeFilterCount = Object.entries(filters).filter(
    ([, v]) => v && v !== "all",
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "gap-0 overflow-hidden p-0",
          // Full-height sheet on phones, centred panel from sm up.
          "flex h-[100dvh] max-h-[100dvh] w-full max-w-full flex-col rounded-none",
          "sm:h-auto sm:max-h-[85vh] sm:max-w-lg sm:rounded-lg",
        )}
        showCloseButton={false}
      >
        <DialogHeader className="space-y-3 border-b px-4 py-3 text-left sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="text-base">
                Select {config.singular.toLowerCase()}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {loading
                  ? "Searching…"
                  : `${total} ${total === 1 ? config.singular.toLowerCase() : config.plural.toLowerCase()} found`}
              </DialogDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-1 h-8 w-8 shrink-0"
              onClick={() => onOpenChange(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                autoFocus
                value={rawQuery}
                onChange={(e) => setRawQuery(e.target.value)}
                placeholder={config.searchPlaceholder}
                className="h-10 pl-9 pr-9"
              />
              {rawQuery ? (
                <button
                  type="button"
                  onClick={() => setRawQuery("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            {visibleFilters.length > 0 ? (
              <Button
                type="button"
                variant={showFilters ? "secondary" : "outline"}
                size="icon"
                className="h-10 w-10 shrink-0"
                onClick={() => setShowFilters((s) => !s)}
                aria-label="Filters"
                aria-expanded={showFilters}
              >
                <SlidersHorizontal className="h-4 w-4" />
                {activeFilterCount > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                    {activeFilterCount}
                  </span>
                ) : null}
              </Button>
            ) : null}
          </div>

          {showFilters && visibleFilters.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleFilters.map((filter) => (
                <div key={filter.key} className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    {filter.label}
                  </label>
                  <Select
                    value={filters[filter.key] ?? "all"}
                    onValueChange={(v) => {
                      setFilters((prev) => ({ ...prev, [filter.key]: v }));
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {filter.options.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">
                  Sort
                </label>
                <Select
                  value={sort}
                  onValueChange={(v) => {
                    setSort(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {config.sorts.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {activeFilterCount > 0 ? (
                <div className="flex items-end sm:col-span-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => {
                      setFilters(defaultFilters ?? {});
                      setPage(1);
                    }}
                  >
                    Reset filters
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </DialogHeader>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {clearable ? (
            <button
              type="button"
              onClick={() => onPick(null)}
              className={cn(
                "flex w-full items-center gap-3 border-b px-4 py-3 text-left text-sm transition-colors hover:bg-accent/50 sm:px-5",
                !value && "bg-accent/40",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-dashed">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </span>
              <span className="flex-1 text-muted-foreground">
                {clearLabel ?? `No ${config.singular.toLowerCase()}`}
              </span>
              {!value ? <Check className="h-4 w-4 text-primary" /> : null}
            </button>
          ) : null}

          {error ? (
            <div className="px-4 py-10 text-center text-sm text-destructive sm:px-5">
              {error}
            </div>
          ) : loading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-12 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading {config.plural.toLowerCase()}…
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-12 text-center sm:px-5">
              <p className="text-sm font-medium">
                No {config.plural.toLowerCase()} found
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {query || activeFilterCount > 0
                  ? "Try a different search or clear the filters."
                  : `No ${config.plural.toLowerCase()} have been added yet.`}
              </p>
            </div>
          ) : (
            <ul className={cn("divide-y", loading && "opacity-60")}>
              {items.map((item) => {
                const isSelected = item.id === value;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      disabled={item.disabled}
                      onClick={() => onPick(item)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors sm:px-5",
                        "hover:bg-accent/50 disabled:cursor-not-allowed disabled:opacity-50",
                        isSelected && "bg-accent/40",
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="truncate text-sm font-medium">
                            {item.label}
                          </span>
                          {item.status && badgeType ? (
                            <StatusBadge
                              status={item.status}
                              type={badgeType}
                              showIcon={false}
                              className="text-[10px]"
                            />
                          ) : null}
                        </div>
                        {item.description ? (
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {item.description}
                          </p>
                        ) : null}
                        {item.disabled && item.disabledReason ? (
                          <p className="mt-0.5 text-xs text-destructive">
                            {item.disabledReason}
                          </p>
                        ) : null}
                      </div>
                      {item.meta ? (
                        <span className="shrink-0 text-right text-xs font-medium tabular-nums text-muted-foreground">
                          {item.meta}
                        </span>
                      ) : null}
                      {isSelected ? (
                        <Check className="h-4 w-4 shrink-0 text-primary" />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {pageCount > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-2.5 sm:px-5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              Prev
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {pageCount}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
            >
              Next
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
