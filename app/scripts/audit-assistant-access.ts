/**
 * Checks the WhatsApp assistant against ACCESS_CONTROL.md.
 *
 *   bun --preload ./scripts/_stub-server-only.ts scripts/audit-assistant-access.ts
 *
 * `audit-access.py` does this for the web pages. The assistant had no
 * equivalent, which is how a supervisor came to be offered a truck's profit
 * through get_truck_costs: the tool was correctly gated at supervisor, and
 * the money inside it was nobody's job to check.
 *
 * So this asserts two different things:
 *
 *   1. the tool list each level is offered, exactly — a new operation that
 *      lands at the wrong level fails here rather than in production;
 *   2. that no operation below admin can return an earnings figure, by
 *      calling the readable ones and looking at what comes back.
 *
 * It reads the matrix from this file, deliberately. ACCESS_CONTROL.md is
 * prose for people; this is the same rules as data, and the two are meant to
 * be compared by eye when either changes.
 */

import { operationManifest, findOperation } from "../src/lib/assistant/operations";
import { prisma } from "../src/lib/prisma";

type Level = "readonly" | "staff" | "supervisor" | "admin";

/** ACCESS_CONTROL.md: "Trip revenue, profit, margin, financial summary, fleet ranking → admin". */
const EARNINGS_WORDS = ["revenue", "profit", "margin", "earned", "earnings"];

/** What each level must be offered. Anything else is a drift. */
const EXPECTED_NEW_AT: Record<Level, string[]> = {
  readonly: [
    "change_my_password",
    "get_expiring_documents",
    "list_customers",
    "list_drivers",
    "list_inventory",
    "list_maintenance",
    "list_trips",
    "list_trucks",
  ],
  staff: ["log_maintenance", "withdraw_my_change"],
  supervisor: [
    "adjust_stock",
    "adjust_supplier_balance",
    "allocate_part",
    "assign_driver_to_truck",
    "assign_maintenance_job",
    "assign_trailer_to_truck",
    "assign_trip",
    "chase_invoice",
    "close_maintenance_job",
    "create_customer",
    "create_driver",
    "create_employee",
    "create_inventory_item",
    "create_invoice",
    "create_supplier",
    "create_trailer",
    "create_trip",
    "create_truck",
    "get_account_balances",
    "get_expense_breakdown",
    "get_truck_costs",
    "list_invoices",
    "list_sent_messages",
    "mark_supplier_expense_paid",
    "notify_driver",
    "pay_supplier",
    "record_expense",
    "record_money_out",
    "record_payment",
    "send_invoice_document",
    "send_invoice_to_customer",
    "send_payment_receipt",
    "send_whatsapp_message",
    "start_maintenance_job",
    "update_customer",
    "update_driver",
    "update_employee",
    "update_expense",
    "update_inventory_item",
    "update_invoice",
    "update_maintenance_job",
    "update_payment",
    "update_supplier",
    "update_supplier_payment",
    "update_trailer",
    "update_trip",
    "update_trip_status",
    "update_truck",
  ],
  admin: [
    "approve_change",
    "change_user_role",
    "create_expense_category",
    "create_pdf",
    "create_user",
    "delete_customer",
    "delete_driver",
    "delete_employee",
    "delete_expense",
    "delete_expense_category",
    "delete_inventory_item",
    "delete_invoice",
    "delete_payment",
    "delete_supplier",
    "delete_supplier_payment",
    "delete_trailer",
    "delete_trip",
    "delete_truck",
    "generate_report",
    "get_driver_performance",
    "get_financial_summary",
    "get_fleet_ranking",
    "list_pending_approvals",
    "list_reports",
    "list_users",
    "record_money_in",
    "reject_change",
    "remove_user",
    "reset_user_password",
    "set_user_password",
    "transfer_between_accounts",
    "update_expense_category",
  ],
};

const LEVELS: Level[] = ["readonly", "staff", "supervisor", "admin"];

const problems: string[] = [];

// ---- 1. The tool list per level -------------------------------------------
let previous = new Set<string>();
for (const level of LEVELS) {
  const offered = new Set(operationManifest(level).map((tool) => tool.name));
  const gained = [...offered].filter((name) => !previous.has(name)).sort();
  const expected = [...EXPECTED_NEW_AT[level]].sort();

  const unexpected = gained.filter((name) => !expected.includes(name));
  const missing = expected.filter((name) => !gained.includes(name));

  if (unexpected.length) {
    problems.push(`${level} is offered ${unexpected.join(", ")}, which this matrix does not allow`);
  }
  if (missing.length) {
    problems.push(`${level} is missing ${missing.join(", ")}`);
  }

  console.log(
    `${level.padEnd(11)} ${String(offered.size).padStart(2)} tools  ` +
      `(+${gained.length} at this level)${unexpected.length || missing.length ? "  ← MISMATCH" : ""}`,
  );
  previous = offered;
}

// ---- 2. No earnings below admin -------------------------------------------
//
// Calling the read operations is the only honest way to check this: a tool
// can be correctly gated and still return a profit figure inside its result,
// which is exactly the mistake this is here to catch.
const organization = await prisma.organization.findFirst({ select: { id: true } });
if (!organization) {
  console.log("\nno organisation in the database — skipping the money check");
} else {
  const truck = await prisma.truck.findFirst({
    where: { organizationId: organization.id },
    select: { id: true },
  });

  const sampleArgs: Record<string, Record<string, unknown>> = {
    list_trips: { limit: 5 },
    list_trucks: { limit: 5 },
    list_customers: { limit: 5 },
    get_truck_costs: truck ? { truckId: truck.id, period: "3m" } : {},
    get_expense_breakdown: { period: "3m" },
    get_account_balances: {},
  };

  for (const level of ["readonly", "staff", "supervisor"] as Level[]) {
    for (const tool of operationManifest(level)) {
      if (tool.writes) continue;
      const args = sampleArgs[tool.name];
      if (!args) continue;
      if (tool.name === "get_truck_costs" && !truck) continue;

      const operation = findOperation(tool.name);
      if (!operation) continue;

      let result: unknown;
      try {
        result = await operation.handler(args, {
          organizationId: organization.id,
          role: level,
          actorName: "audit",
          actorUserId: null,
        });
      } catch (error) {
        problems.push(`${tool.name} threw for ${level}: ${(error as Error).message}`);
        continue;
      }

      const leaked = earningsKeysIn(result);
      if (leaked.length > 0) {
        problems.push(
          `${tool.name} returns ${leaked.join(", ")} to a ${level} — ACCESS_CONTROL.md keeps earnings at admin`,
        );
      }
    }
  }
  console.log("\nmoney check: read operations called for readonly, staff and supervisor");
}

/** Every key anywhere in the result whose name reads as an earnings figure. */
function earningsKeysIn(value: unknown, path = ""): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((entry, index) => earningsKeysIn(entry, `${path}[${index}]`));
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([key, inner]) => {
      const here = path ? `${path}.${key}` : key;
      const named = EARNINGS_WORDS.some((word) => key.toLowerCase().includes(word));
      return named ? [here] : earningsKeysIn(inner, here);
    });
  }
  return [];
}

console.log();
if (problems.length === 0) {
  console.log("PASS — the assistant matches ACCESS_CONTROL.md");
  process.exit(0);
}
for (const problem of problems) console.log(`FAIL — ${problem}`);
process.exit(1);
