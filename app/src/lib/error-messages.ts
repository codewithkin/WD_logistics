/**
 * Turns a caught error into something a person can actually act on.
 *
 * Server actions across the app all used to do the same thing with a caught
 * error: `console.error` it and return a flat "Failed to create expense" —
 * so a unique-constraint clash, a deleted related record and a dead database
 * connection all looked identical to the user, and the one detail that would
 * have told them what to fix only ever reached the server log.
 *
 * Deliberately has no Prisma import: Prisma errors are recognised by shape,
 * not `instanceof`. That keeps this module safe to import from client
 * components too (importing the generated client into the browser bundle has
 * broken pages in this app before — see the accounts.ts/accounts-server.ts
 * split).
 */

/**
 * Throw this from a server action when you have already written the sentence
 * the user should read. `toUserMessage` passes its message straight through.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserFacingError";
  }
}

/**
 * Existing domain errors whose messages were written for users, not
 * developers. Matched by name so this module doesn't have to import them.
 */
const USER_FACING_ERROR_NAMES = new Set([
  "UserFacingError",
  "InsufficientBalanceError",
  "InsufficientStockError",
  "SupplierNotFoundError",
]);

interface PrismaLikeError {
  name: string;
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

function isPrismaKnownError(error: unknown): error is PrismaLikeError {
  if (typeof error !== "object" || error === null) return false;
  const e = error as Record<string, unknown>;
  return (
    e.name === "PrismaClientKnownRequestError" &&
    typeof e.code === "string" &&
    e.code.startsWith("P")
  );
}

function isUserFacing(error: unknown): error is Error {
  return error instanceof Error && USER_FACING_ERROR_NAMES.has(error.name);
}

const FIELD_LABELS: Record<string, string> = {
  sku: "SKU",
  registrationNo: "registration number",
  licenseNo: "licence number",
  invoiceNumber: "invoice number",
  email: "email address",
  phone: "phone number",
  taxId: "tax ID",
  organizationId: "organisation",
};

/** `registrationNo` -> "registration number", `email` -> "email address". */
function humanizeField(field: string): string {
  const cleaned = field.replace(/Id$/, "");
  if (FIELD_LABELS[field]) return FIELD_LABELS[field];
  if (FIELD_LABELS[cleaned]) return FIELD_LABELS[cleaned];
  return cleaned
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .toLowerCase()
    .trim();
}

/**
 * The column names a unique/foreign-key violation names, if it names any.
 *
 * Prisma only fills `meta.target` when it drives the connection itself. This
 * app goes through @prisma/adapter-pg, where the only clue is Postgres's own
 * constraint name buried in `meta.driverAdapterError` — e.g.
 * "inventory_item_organizationId_sku_key" or "expense_supplierId_fkey".
 */
function metaFields(meta: Record<string, unknown> | undefined): string[] {
  if (!meta) return [];

  const direct = meta.target ?? meta.field_name;
  if (Array.isArray(direct)) {
    return direct.filter((v): v is string => typeof v === "string" && !isScopeColumn(v));
  }
  if (typeof direct === "string") {
    return isScopeColumn(direct) ? [] : [direct];
  }

  const constraint = constraintName(meta);
  return constraint ? columnsFromConstraint(constraint) : [];
}

function constraintName(meta: Record<string, unknown>): string | null {
  const adapterError = meta.driverAdapterError as { cause?: unknown } | undefined;
  const cause = adapterError?.cause as { constraint?: unknown } | undefined;
  const constraint = cause?.constraint as { index?: unknown; fields?: unknown } | undefined;
  if (typeof constraint?.index === "string") return constraint.index;
  if (Array.isArray(constraint?.fields)) {
    const fields = constraint.fields.filter((v): v is string => typeof v === "string");
    if (fields.length > 0) return fields.join("_");
  }
  return null;
}

/**
 * Pull the column names back out of a Postgres constraint name. Table names
 * here are snake_case and columns are camelCase, so the first segment with a
 * capital in it marks where the table name ends; failing that, the last
 * segment is the column.
 */
function columnsFromConstraint(constraint: string): string[] {
  const withoutSuffix = constraint.replace(/_(fkey|key|unique|pkey|idx)$/i, "");
  const segments = withoutSuffix.split("_").filter(Boolean);
  if (segments.length === 0) return [];

  const firstCamel = segments.findIndex((seg) => /[A-Z]/.test(seg));
  const columns = firstCamel === -1 ? segments.slice(-1) : segments.slice(firstCamel);
  return columns.filter((column) => !isScopeColumn(column));
}

/** organizationId scopes every table here; naming it would only confuse. */
function isScopeColumn(column: string): boolean {
  return column === "organizationId";
}

function joinFields(fields: string[]): string {
  const labels = fields.map(humanizeField);
  if (labels.length === 0) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * @param error    whatever was caught
 * @param fallback what to say when the error carries nothing useful, e.g.
 *                 "Failed to create expense" — keep the existing wording so
 *                 nothing regresses for errors we can't explain.
 */
export function toUserMessage(error: unknown, fallback: string): string {
  if (isUserFacing(error)) return error.message;

  if (isPrismaKnownError(error)) {
    const fields = metaFields(error.meta);
    const named = joinFields(fields);

    switch (error.code) {
      case "P2002":
        return named
          ? `Another record already uses that ${named}. Please enter a different one.`
          : "A record with these details already exists.";
      case "P2003":
        return named
          ? `The selected ${named} no longer exists — it may have been deleted. Please refresh the page and choose another.`
          : "This is linked to a record that no longer exists — it may have been deleted. Please refresh the page and try again.";
      case "P2014":
        return "Something else still depends on this record, so it can't be changed. Remove the linked records first.";
      case "P2025":
        return "That record could not be found — someone may have deleted it already. Please refresh the page.";
      case "P2011":
        return named
          ? `${capitalise(named)} is required.`
          : "A required field was left empty.";
      case "P2000":
        return named
          ? `The value entered for ${named} is too long.`
          : "One of the values entered is too long.";
      case "P2024":
        return "The database is busy and didn't respond in time. Please try again in a moment.";
      case "P1001":
      case "P1002":
      case "P1008":
      case "P1017":
        return "Couldn't reach the database. Please try again in a moment — if it keeps happening, contact your administrator.";
      default:
        return fallback;
    }
  }

  return fallback;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/**
 * The whole catch block in one call: log the real error for whoever has to
 * debug it, hand the user a sentence that means something.
 *
 * @param logLabel what to log it under, when that differs from what the user
 *                 should read (e.g. log "Failed to export invoices PDF", tell
 *                 the user "Failed to generate PDF report").
 */
export function handleActionError(
  error: unknown,
  fallback: string,
  logLabel: string = fallback
): { success: false; error: string } {
  console.error(`${logLabel}:`, error);
  return { success: false, error: toUserMessage(error, fallback) };
}
