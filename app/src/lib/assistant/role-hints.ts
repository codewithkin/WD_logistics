/**
 * What the assistant will do for each role, in one sentence, as shown on
 * Settings → WhatsApp beside every contact.
 *
 * These live here rather than in the component so that
 * `scripts/audit-assistant-access.ts` can check them. It cannot import a
 * `"use client"` file, and a promise on that page is worth exactly as much as
 * the tool list behind it.
 *
 * Four of these have been wrong so far, which is why the check exists:
 *
 * - read only claimed to change nothing, when it can always change its own
 *   password;
 * - staff claimed to see invoices, which start at supervisor;
 * - staff claimed to report a fault, after `log_maintenance` moved up to
 *   supervisor — ACCESS_CONTROL.md gives staff no maintenance at all;
 * - supervisor claimed to see account balances, which moved to admin on
 *   30 Sep 2026.
 *
 * Every one broke the same way: an operation moved a level and the prose
 * describing it stayed put. Nobody spots that by reading the page, because
 * the sentence reads perfectly well either way — so `bun run check:access`
 * ties each claim to the tool that would have to exist for it to be true.
 *
 * Only the part before the word "no" is read as a promise: "No account
 * balances, revenue, profit or reports" names those in order to deny them.
 */
export const ROLE_HINTS: Record<string, string> = {
  readonly:
    "Can ask about trucks, drivers, trips, stock, customers and expiring documents. Sees no money, and changes nothing but their own password.",
  staff:
    "As read only, plus taking back a change they have sent for approval. Creating and editing records is done in the app, not here.",
  supervisor:
    "Records expenses, payments and money out, schedules trips, adjusts stock, manages customers, suppliers and invoices, and sees a truck's kilometres, litres and downtime. No account balances, revenue, profit or reports.",
  admin:
    "Everything, including revenue, profit, per-truck costs and generated reports.",
};
