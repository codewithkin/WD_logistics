import { Role } from "@/lib/types";

// Permission definitions for each role
export const ROLE_PERMISSIONS = {
  admin: {
    // User Management
    canCreateUsers: true,
    canEditUsers: true,
    canDeleteUsers: true,
    
    // Data Management
    canCreate: true,
    canEdit: true,
    canDelete: true,
    
    // Edit Requests
    canApproveEditRequests: true,
    canViewAllEditRequests: true,
    
    // Reports
    canViewReports: true,
    canGenerateReports: true,
    
    // Settings
    canAccessSettings: true,
    
    // Financial Data
    canViewFinancials: true,
    canViewRevenue: true,
    canViewExpenses: true,
    canViewPerformanceMetrics: true,
  },
  supervisor: {
    // User Management
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,

    // Data Management. Creating stays direct; changing and removing an
    // existing record goes to an admin as a request — see lib/edit-requests.
    canCreate: true,
    canEdit: false,
    canDelete: false,

    // Edit Requests: supervisors raise them and watch their own, but an
    // approval by the person who would otherwise have edited directly is not
    // an approval at all.
    canApproveEditRequests: false,
    canViewAllEditRequests: true,
    
    // Reports: admin only, all 23 of them, and every export button on every
    // list page with them (ACCESS_CONTROL.md). This said `true` — nothing read
    // it, but it is the sentence someone re-derives the rule from.
    canViewReports: false,
    canGenerateReports: false,

    // Settings
    canAccessSettings: false,

    // Financial Data - Supervisors have restricted access
    canViewFinancials: false,
    canViewRevenue: false,
    canViewExpenses: false, // Can be overridden by SHOW_EXPENSES env
    canViewPerformanceMetrics: false,
  },
  staff: {
    // User Management
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,
    
    // Data Management
    canCreate: true,
    canEdit: false, // Staff edits require approval
    canDelete: false,
    
    // Edit Requests
    canApproveEditRequests: false,
    canViewAllEditRequests: false, // Can only view own requests
    
    // Reports
    canViewReports: false,
    canGenerateReports: false,
    
    // Settings
    canAccessSettings: false,
    
    // Financial Data - Staff have no access
    canViewFinancials: false,
    canViewRevenue: false,
    canViewExpenses: false,
    canViewPerformanceMetrics: false,
  },
  // Workshop: narrowest role. General app access is fail-closed by design —
  // their only granted surface is the dedicated maintenance-requests feature,
  // gated separately via its own requireRole() calls, not this map.
  workshop: {
    // User Management
    canCreateUsers: false,
    canEditUsers: false,
    canDeleteUsers: false,

    // Data Management
    canCreate: false,
    canEdit: false,
    canDelete: false,

    // Edit Requests
    canApproveEditRequests: false,
    canViewAllEditRequests: false,

    // Reports
    canViewReports: false,
    canGenerateReports: false,

    // Settings
    canAccessSettings: false,

    // Financial Data
    canViewFinancials: false,
    canViewRevenue: false,
    canViewExpenses: false,
    canViewPerformanceMetrics: false,
  },
} as const;

export type RolePermissions = typeof ROLE_PERMISSIONS[Role];

export function getPermissions(role: Role): RolePermissions {
  return ROLE_PERMISSIONS[role];
}

export function hasPermission(role: Role, permission: keyof RolePermissions): boolean {
  return ROLE_PERMISSIONS[role][permission];
}

/**
 * Check if user can view expenses page
 * Supervisors have full access to expenses for data input
 */
export function canViewExpensesPage(role: Role): boolean {
  if (role === "admin") return true;
  if (role === "supervisor") return true; // Supervisors can view and add expenses
  return false;
}

/**
 * Check if user can create/add expenses
 */
export function canCreateExpenses(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Check if user can generate expense reports
 * Only admins can generate reports
 */
export function canGenerateExpenseReports(role: Role): boolean {
  return role === "admin";
}

/**
 * Check if user can view financial data (revenue, expenses, performance metrics)
 */
export function canViewFinancialData(role: Role): boolean {
  return role === "admin";
}

/**
 * Who may see what a *single piece of work* cost — an expense amount, a
 * trip's expenses, what a supplier was paid.
 *
 * Distinct from `canViewFinancialData`, which governs what the business
 * *earns*: revenue, profit and margin. A supervisor records spending, so they
 * need the figure in front of them to do the job.
 *
 * Narrowed on 2026-09-30: this no longer covers what those costs *add up to*.
 * A running total a supervisor did not enter themselves — a truck's lifetime
 * spend, a category's share, an account's balance — is the same number the
 * owner runs the business on, reached by a different door. Those have their
 * own predicates below, and they are admin-only.
 */
export function canViewCostData(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Who may see what one truck has *cost*: its expense total, the breakdown by
 * category, cost per km, fuel spend, what its time in the workshop came to.
 *
 * Admin. A supervisor keeps the physical side of the same page — litres,
 * parts fitted, days off the road, km per litre — because that is what
 * running a fleet needs, and none of it totals to money (ACCESS_CONTROL.md,
 * "Expenses by truck: quantities only").
 */
export function canViewFleetCostTotals(role: Role): boolean {
  return role === "admin";
}

/**
 * Who may see spending grouped by expense category, anywhere it appears — the
 * category breakdown on a truck, the by-category charts, the category detail
 * pages' money.
 *
 * Admin. The chart of accounts is how the owner reads the business.
 */
export function canViewCostsByCategory(role: Role): boolean {
  return role === "admin";
}

/**
 * The analytics tab on both expenses pages — the charts, the trends, the
 * totals by truck, trip, driver and category.
 *
 * Admin. A supervisor gets the list, which is the part of the page they work
 * in; the tab beside it is a report in everything but name.
 */
export function canViewExpenseAnalytics(role: Role): boolean {
  return role === "admin";
}

/**
 * Fuel *economy* — litres, km per litre, litres per 100km.
 *
 * Supervisor included, deliberately: it is a number about the truck and the
 * driver, not about the money. `canViewFleetCostTotals` governs the cost side
 * of the same panel — fuel spend, cost per km — and that stays with the
 * admin.
 */
export function canViewFuelEconomy(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Who may add a truck, a trailer, a driver or a trip.
 *
 * Staff included, and that is the whole reason the role exists:
 * ACCESS_CONTROL.md gives them "see and create" on exactly these four, and
 * "staff exist for typing in fleet and trip records". Every one of those four
 * create pages and create actions was admin-and-supervisor, so the role could
 * do nothing but read. Creating is direct for all three — it is *changing* an
 * existing record that becomes an edit request.
 *
 * Deliberately narrow: it does not cover customers, suppliers, employees,
 * invoices, payments, expenses or stock, none of which staff can see at all.
 */
export function canCreateFleetRecords(role: Role): boolean {
  return role === "admin" || role === "supervisor" || role === "staff";
}

/**
 * Who may see what is *owed* — a customer's outstanding balance, a supplier's
 * ledger, an invoice's amount still due.
 *
 * Debt is not earnings. ACCESS_CONTROL.md grants "invoices, payments, what a
 * customer owes" to admin and supervisor, and the customers list has always
 * shown a supervisor the balance column. The entity pickers were stricter
 * than the pages they open from, so a supervisor recording a payment could
 * not see how much the invoice had left on it.
 */
export function canViewDebtData(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

/**
 * Who may write to an existing record without asking.
 *
 * Only the admin. Everyone else's edit becomes an EditRequest carrying a real
 * before/after diff, which the admin accepts or refuses. This predicate is
 * the one place that decides it — see lib/edit-requests/gate.ts for the gate
 * every update action calls.
 */
export function canEditDirectly(role: Role): boolean {
  return role === "admin";
}

/**
 * The one exception to "every change by a non-admin becomes a request".
 *
 * Moving a trip along — scheduled, in progress, completed — is the thing
 * operations does all day, from a yard, often on a phone. Sending each of
 * those through an admin would either stop the work or train everyone to
 * approve without reading, which is worse than not asking.
 *
 * It applies to the status and nothing else. Any other field on the trip,
 * changed on its own or alongside the status, is a request like everything
 * else. Workshop and readonly are not here because they have no business
 * with trips at all.
 */
export function canChangeTripStatusDirectly(role: Role): boolean {
  return role === "admin" || role === "supervisor" || role === "staff";
}

/**
 * Expense categories are the chart of accounts for the whole business — every
 * expense, every per-truck cost breakdown and every report groups by them — so
 * creating, renaming and deleting them is admin-only. Everyone else reads.
 */
export function canManageExpenseCategories(role: Role): boolean {
  return role === "admin";
}

// Check if user can delete directly
export function canDeleteDirectly(role: Role): boolean {
  return role === "admin";
}

/**
 * The three account balances (Cash, Bank, Petty Cash), wherever they appear —
 * the accounts page, the cards on the expenses page, the picker in a
 * movement dialog, the assistant.
 *
 * Admin only as of 2026-09-30. This used to be an explicit carve-out for
 * supervisors, on the reasoning that somebody spending needs to know what is
 * there. The client decided otherwise: what the business holds is the
 * owner's, and a supervisor who needs to spend more than there is should be
 * told by the admin, not by the screen.
 */
export function canViewAccountBalances(role: Role): boolean {
  return role === "admin";
}

/**
 * Money-**in** entries in an account's history.
 *
 * Admin. Hiding the balance while listing every deposit and every payment out
 * hides nothing: the two columns add up to the balance with a calculator. A
 * supervisor sees the money-**out** side, so they can check their own work,
 * and no running total beside it.
 */
export function canViewMoneyIn(role: Role): boolean {
  return role === "admin";
}

// Only admins can transfer funds between accounts (e.g. petty cash <-> cash)
export function canTransferFunds(role: Role): boolean {
  return role === "admin";
}

// Money OUT of an account: spending. Every entry is logged against the
// person who recorded it, which is what makes it safe to open to supervisors
// — they are the ones doing the spending.
export function canRecordMoneyOut(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

// Money IN, and the opening balance: admin only. Per ACCESS_CONTROL.md,
// "a supervisor can see what is in each account and take money out of it,
// because they spend. Only an admin puts money in." The server enforces
// this in finance/accounts/actions.ts; these exist so the UI stops offering
// a supervisor a button that is going to refuse them.
export function canRecordMoneyIn(role: Role): boolean {
  return role === "admin";
}

/** Either direction — for deciding whether the section appears at all. */
export function canRecordAccountMovements(role: Role): boolean {
  return canRecordMoneyIn(role) || canRecordMoneyOut(role);
}

/**
 * Inventory/warehouse: admin and supervisor can both see stock (quantities,
 * items, categories), but only admin sees the dollar value breakdown
 * (unit cost × quantity, per-category totals) — an explicit split matching
 * the same admin-only financial visibility pattern used elsewhere.
 */
export function canViewInventory(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}

export function canViewInventoryValue(role: Role): boolean {
  return role === "admin";
}

export function canManageInventory(role: Role): boolean {
  return role === "admin" || role === "supervisor";
}
