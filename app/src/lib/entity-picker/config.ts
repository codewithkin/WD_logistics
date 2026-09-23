/**
 * Shared, client-safe metadata for the entity picker.
 *
 * The picker replaces every "choose a related record" <Select> in the app with
 * a searchable, filterable, paginated dialog. This module holds only the parts
 * both sides need to agree on — the entity names, their labels and the filter
 * controls each one offers. The actual querying lives in
 * `src/app/(dashboard)/_actions/entity-search.ts`, which is server-only.
 *
 * Adding a new pickable entity means adding an entry here *and* a matching
 * case in the server action. Keep the two in sync — the `EntityKind` union is
 * what makes a mismatch a type error rather than a runtime 500.
 */

export const ENTITY_KINDS = [
  "truck",
  "trailer",
  "driver",
  "customer",
  "supplier",
  "employee",
  "trip",
  "invoice",
  "expenseCategory",
  "inventoryItem",
  "account",
  "user",
] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

/** One row in the picker's result list. */
export interface EntityOption {
  id: string;
  /** Primary line — the name/registration the user recognises. */
  label: string;
  /** Secondary line — make/model, contact person, route, etc. */
  description?: string;
  /** Right-aligned value — amount, balance, date. */
  meta?: string;
  /** Rendered as a status pill when present. */
  status?: string;
  /** Optional avatar/thumbnail URL. */
  image?: string | null;
  /** Set when the record should be visible but not selectable. */
  disabled?: boolean;
  /** Explains why it is disabled. */
  disabledReason?: string;
}

export interface EntitySearchResult {
  items: EntityOption[];
  total: number;
  page: number;
  pageSize: number;
  /** True when the caller asked for filters this entity doesn't support. */
  warnings?: string[];
}

/** A dropdown filter offered inside the picker dialog. */
export interface EntityFilterDef {
  /** Key sent back in `filters`. */
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

export interface EntityKindConfig {
  kind: EntityKind;
  /** "Truck" — used in the trigger placeholder and dialog title. */
  singular: string;
  /** "Trucks" — used in the empty state and result count. */
  plural: string;
  /** Placeholder for the search box, naming what is actually searched. */
  searchPlaceholder: string;
  /** Lucide icon name rendered in the trigger; resolved in the component. */
  icon: string;
  /** Filters shown above the result list. */
  filters: EntityFilterDef[];
  /** Sort options shown in the dialog. */
  sorts: Array<{ value: string; label: string }>;
  /** Default sort key. */
  defaultSort: string;
}

const STATUS_FILTER = (
  options: Array<{ value: string; label: string }>,
): EntityFilterDef => ({
  key: "status",
  label: "Status",
  options: [{ value: "all", label: "Any status" }, ...options],
});

const VEHICLE_STATUSES = [
  { value: "active", label: "Active" },
  { value: "in_service", label: "In Service" },
  { value: "in_repair", label: "In Repair" },
  { value: "inactive", label: "Inactive" },
  { value: "decommissioned", label: "Decommissioned" },
];

const PERSON_STATUSES = [
  { value: "active", label: "Active" },
  { value: "on_leave", label: "On Leave" },
  { value: "suspended", label: "Suspended" },
  { value: "terminated", label: "Terminated" },
];

const PARTY_STATUSES = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "suspended", label: "Suspended" },
];

const NAME_SORTS = [
  { value: "name_asc", label: "Name (A–Z)" },
  { value: "name_desc", label: "Name (Z–A)" },
  { value: "created_desc", label: "Newest first" },
];

export const ENTITY_CONFIG: Record<EntityKind, EntityKindConfig> = {
  truck: {
    kind: "truck",
    singular: "Truck",
    plural: "Trucks",
    searchPlaceholder: "Search by registration, make or model…",
    icon: "Truck",
    filters: [
      STATUS_FILTER(VEHICLE_STATUSES),
      {
        key: "assignment",
        label: "Driver",
        options: [
          { value: "all", label: "Any" },
          { value: "assigned", label: "Has a driver" },
          { value: "unassigned", label: "No driver" },
        ],
      },
    ],
    sorts: [
      { value: "name_asc", label: "Registration (A–Z)" },
      { value: "name_desc", label: "Registration (Z–A)" },
      { value: "created_desc", label: "Newest first" },
    ],
    defaultSort: "name_asc",
  },
  trailer: {
    kind: "trailer",
    singular: "Trailer",
    plural: "Trailers",
    searchPlaceholder: "Search by registration, make or type…",
    icon: "Container",
    filters: [
      STATUS_FILTER(VEHICLE_STATUSES),
      {
        key: "assignment",
        label: "Truck",
        options: [
          { value: "all", label: "Any" },
          { value: "assigned", label: "Hitched to a truck" },
          { value: "unassigned", label: "Unhitched" },
        ],
      },
    ],
    sorts: [
      { value: "name_asc", label: "Registration (A–Z)" },
      { value: "name_desc", label: "Registration (Z–A)" },
      { value: "created_desc", label: "Newest first" },
    ],
    defaultSort: "name_asc",
  },
  driver: {
    kind: "driver",
    singular: "Driver",
    plural: "Drivers",
    searchPlaceholder: "Search by name, phone or licence…",
    icon: "User",
    filters: [
      STATUS_FILTER(PERSON_STATUSES),
      {
        key: "assignment",
        label: "Truck",
        options: [
          { value: "all", label: "Any" },
          { value: "assigned", label: "Has a truck" },
          { value: "unassigned", label: "No truck" },
        ],
      },
    ],
    sorts: NAME_SORTS,
    defaultSort: "name_asc",
  },
  customer: {
    kind: "customer",
    singular: "Customer",
    plural: "Customers",
    searchPlaceholder: "Search by name, contact, phone or email…",
    icon: "Building2",
    filters: [
      STATUS_FILTER(PARTY_STATUSES),
      {
        key: "balance",
        label: "Balance",
        options: [
          { value: "all", label: "Any" },
          { value: "owing", label: "Owes us money" },
          { value: "clear", label: "Settled" },
        ],
      },
    ],
    sorts: [...NAME_SORTS, { value: "balance_desc", label: "Highest balance" }],
    defaultSort: "name_asc",
  },
  supplier: {
    kind: "supplier",
    singular: "Supplier",
    plural: "Suppliers",
    searchPlaceholder: "Search by name, contact, phone or email…",
    icon: "Store",
    filters: [
      STATUS_FILTER(PARTY_STATUSES),
      {
        key: "balance",
        label: "Balance",
        options: [
          { value: "all", label: "Any" },
          { value: "owing", label: "We owe them" },
          { value: "clear", label: "Settled" },
        ],
      },
    ],
    sorts: [...NAME_SORTS, { value: "balance_desc", label: "Highest balance" }],
    defaultSort: "name_asc",
  },
  employee: {
    kind: "employee",
    singular: "Employee",
    plural: "Employees",
    searchPlaceholder: "Search by name, position or department…",
    icon: "Users",
    filters: [STATUS_FILTER(PERSON_STATUSES)],
    sorts: NAME_SORTS,
    defaultSort: "name_asc",
  },
  trip: {
    kind: "trip",
    singular: "Trip",
    plural: "Trips",
    searchPlaceholder: "Search by trip number, route or customer…",
    icon: "Route",
    filters: [
      STATUS_FILTER([
        { value: "scheduled", label: "Scheduled" },
        { value: "in_progress", label: "In Progress" },
        { value: "completed", label: "Completed" },
        { value: "cancelled", label: "Cancelled" },
      ]),
    ],
    sorts: [
      { value: "date_desc", label: "Most recent" },
      { value: "date_asc", label: "Oldest first" },
      { value: "name_asc", label: "Trip number" },
    ],
    defaultSort: "date_desc",
  },
  invoice: {
    kind: "invoice",
    singular: "Invoice",
    plural: "Invoices",
    searchPlaceholder: "Search by invoice number or customer…",
    icon: "FileText",
    filters: [
      STATUS_FILTER([
        { value: "draft", label: "Draft" },
        { value: "sent", label: "Sent" },
        { value: "partial", label: "Partially paid" },
        { value: "paid", label: "Paid" },
        { value: "overdue", label: "Overdue" },
        { value: "cancelled", label: "Cancelled" },
      ]),
      {
        key: "balance",
        label: "Balance",
        options: [
          { value: "all", label: "Any" },
          { value: "owing", label: "Outstanding" },
          { value: "clear", label: "Fully paid" },
        ],
      },
    ],
    sorts: [
      { value: "date_desc", label: "Most recent" },
      { value: "date_asc", label: "Oldest first" },
      { value: "balance_desc", label: "Largest balance" },
    ],
    defaultSort: "date_desc",
  },
  expenseCategory: {
    kind: "expenseCategory",
    singular: "Category",
    plural: "Categories",
    searchPlaceholder: "Search categories…",
    icon: "Tags",
    filters: [
      {
        key: "appliesTo",
        label: "Applies to",
        options: [
          { value: "all", label: "Anything" },
          { value: "trip", label: "Trips" },
          { value: "truck", label: "Trucks" },
          { value: "driver", label: "Drivers" },
        ],
      },
    ],
    sorts: NAME_SORTS,
    defaultSort: "name_asc",
  },
  inventoryItem: {
    kind: "inventoryItem",
    singular: "Part",
    plural: "Parts",
    searchPlaceholder: "Search by part name, number or category…",
    icon: "Package",
    filters: [
      {
        key: "stock",
        label: "Stock",
        options: [
          { value: "all", label: "Any" },
          { value: "in_stock", label: "In stock" },
          { value: "low", label: "At or below reorder level" },
          { value: "out", label: "Out of stock" },
        ],
      },
    ],
    sorts: [...NAME_SORTS, { value: "stock_asc", label: "Lowest stock" }],
    defaultSort: "name_asc",
  },
  account: {
    kind: "account",
    singular: "Account",
    plural: "Accounts",
    searchPlaceholder: "Search accounts…",
    icon: "Wallet",
    filters: [],
    sorts: [...NAME_SORTS, { value: "balance_desc", label: "Highest balance" }],
    defaultSort: "name_asc",
  },
  user: {
    kind: "user",
    singular: "User",
    plural: "Users",
    searchPlaceholder: "Search by name or email…",
    icon: "UserCog",
    filters: [
      {
        key: "role",
        label: "Role",
        options: [
          { value: "all", label: "Any role" },
          { value: "admin", label: "Admin" },
          { value: "supervisor", label: "Supervisor" },
          { value: "staff", label: "Staff" },
          { value: "workshop", label: "Workshop" },
        ],
      },
    ],
    sorts: NAME_SORTS,
    defaultSort: "name_asc",
  },
};

/** How many rows one page of the picker shows. The client asked for 10. */
export const ENTITY_PAGE_SIZE = 10;

export interface EntitySearchParams {
  kind: EntityKind;
  query?: string;
  /** Entity-specific filters — see each kind's `filters` in ENTITY_CONFIG. */
  filters?: Record<string, string>;
  page?: number;
  sort?: string;
  /**
   * Restricts results to records related to another record, e.g. only the
   * invoices of one customer. Interpreted per kind by the server action.
   */
  scope?: { key: string; value: string };
  /**
   * Always include these ids in the result even if they fall outside the
   * current filter/search, so an already-selected record never vanishes.
   */
  includeIds?: string[];
}
