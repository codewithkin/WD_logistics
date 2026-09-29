"""Checks that everything the web app can do, the assistant can do too.

Run from app/:  python <this file>

The client's requirement: "make sure EVERYTHING doable in the web app is
possible in the agent". This is that requirement as data.

It walks every exported server action under src/app/(dashboard) — the web
app's whole write surface, since this codebase does its work in actions rather
than REST routes — and insists each one is either

  * covered by a named assistant operation, which must exist, or
  * listed in WEB_ONLY with the reason it stays at a desk.

An action that is neither fails the audit. That is the point: the next feature
added to the web app cannot quietly become web-only. Whoever adds it has to
either give the assistant an operation or write down why not.

Read-only actions (get*/list*/search*) are not required to have an operation
of their own — the assistant has its own read surface shaped for conversation
rather than for a table — but the export and download actions are checked,
because a document somebody wants is usually wanted on a phone.
"""
import io
import os
import re

# web action -> the assistant operation(s) that cover it
COVERED = {
    # account
    "changePassword": ["change_my_password"],
    # customers
    "createCustomer": ["create_customer"],
    "updateCustomer": ["update_customer"],
    "deleteCustomer": ["delete_customer"],
    # edit requests
    "approveEditRequest": ["approve_change"],
    "rejectEditRequest": ["reject_change"],
    "withdrawEditRequest": ["withdraw_my_change"],
    # employees
    "createEmployee": ["create_employee"],
    "updateEmployee": ["update_employee"],
    "deleteEmployee": ["delete_employee"],
    # accounts
    "recordAccountMovementAction": ["record_money_in", "record_money_out"],
    "transferFundsAction": ["transfer_between_accounts"],
    # expense categories (two copies of these actions exist; both covered)
    "createExpenseCategory": ["create_expense_category"],
    "updateExpenseCategory": ["update_expense_category"],
    "deleteExpenseCategory": ["delete_expense_category"],
    # expenses (finance and operations both export these names)
    "createExpense": ["record_expense"],
    "updateExpense": ["update_expense"],
    "deleteExpense": ["delete_expense"],
    "exportExpensesPDF": ["generate_report"],
    "exportTruckExpensesPDF": ["generate_report"],
    "exportOperationsExpensesPDF": ["generate_report"],
    "exportCategoryExpensesPDF": ["generate_report"],
    # invoices
    "createInvoice": ["create_invoice"],
    "updateInvoice": ["update_invoice"],
    "deleteInvoice": ["delete_invoice"],
    "sendInvoiceToCustomer": ["send_invoice_to_customer"],
    "sendInvoiceReminderByWhatsApp": ["chase_invoice"],
    "sendInvoiceReminderByEmail": ["chase_invoice"],
    "downloadSingleInvoicePDF": ["send_invoice_document"],
    "exportInvoicesPDF": ["generate_report"],
    # payments
    "createPayment": ["record_payment"],
    "updatePayment": ["update_payment"],
    "deletePayment": ["delete_payment"],
    "downloadPaymentReceiptPDF": ["send_payment_receipt"],
    "exportPaymentsPDF": ["generate_report"],
    # supplier payments
    "createSupplierPayment": ["pay_supplier"],
    "updateSupplierPayment": ["update_supplier_payment"],
    "deleteSupplierPayment": ["delete_supplier_payment"],
    # drivers
    "createDriver": ["create_driver"],
    "updateDriver": ["update_driver"],
    "deleteDriver": ["delete_driver"],
    "assignTruckToDriver": ["assign_driver_to_truck"],
    "exportDriversPDF": ["generate_report"],
    "exportSingleDriverReport": ["generate_report"],
    # trailers
    "createTrailer": ["create_trailer"],
    "updateTrailer": ["update_trailer"],
    "deleteTrailer": ["delete_trailer"],
    "assignTruckToTrailer": ["assign_trailer_to_truck"],
    "exportTrailersPDF": ["generate_report"],
    "exportSingleTrailerReport": ["generate_report"],
    # trucks
    "createTruck": ["create_truck"],
    "updateTruck": ["update_truck"],
    "deleteTruck": ["delete_truck"],
    "assignDriverToTruck": ["assign_driver_to_truck"],
    "exportTrucksPDF": ["generate_report"],
    "exportSingleTruckReport": ["generate_report"],
    # inventory
    "createInventoryItem": ["create_inventory_item"],
    "updateInventoryItem": ["update_inventory_item"],
    "deleteInventoryItem": ["delete_inventory_item"],
    "addStock": ["adjust_stock"],
    "takeOutStock": ["adjust_stock"],
    "allocatePart": ["allocate_part"],
    # maintenance
    "createMaintenanceRequest": ["log_maintenance"],
    "assignMaintenanceRequest": ["assign_maintenance_job"],
    "startMaintenanceWork": ["start_maintenance_job"],
    "markMaintenanceRequestFixed": ["close_maintenance_job"],
    "updateMaintenanceRequest": ["update_maintenance_job"],
    # trips
    "createTrip": ["create_trip"],
    "updateTrip": ["update_trip", "update_trip_status"],
    "deleteTrip": ["delete_trip"],
    "resendTripMessage": ["notify_driver"],
    "exportTripsPDF": ["generate_report"],
    "exportSingleTripReport": ["generate_report"],
    "exportTripProfitLossPDF": ["generate_report"],
    # suppliers
    "createSupplier": ["create_supplier"],
    "updateSupplier": ["update_supplier"],
    "deleteSupplier": ["delete_supplier"],
    "updateSupplierBalance": ["adjust_supplier_balance"],
    "markExpenseAsPaid": ["mark_supplier_expense_paid"],
    # customers, exports
    "exportCustomersPDF": ["generate_report"],
    "exportCustomerDetailPDF": ["generate_report"],
    "exportCustomerDetailWord": ["generate_report"],
    # employees, exports
    "exportEmployeesPDF": ["generate_report"],
    # reports
    "generateReport": ["generate_report", "list_reports"],
    "exportDashboardPDF": ["get_financial_summary", "create_pdf"],
    # users
    "inviteUser": ["create_user"],
    "inviteMember": ["create_user"],
    "createUserWithRole": ["create_user"],
    "createSupervisor": ["create_user"],
    "updateMemberRole": ["change_user_role"],
    "removeMember": ["remove_user"],
    "resetUserPassword": ["reset_user_password"],
    "setUserPassword": ["set_user_password"],
}

# Web-only, each with the reason. Adding to this list is a decision, not a
# shortcut — the reason is what the next person reads.
WEB_ONLY = {
    "wipeAllData":
        "Irreversible, and there is no 'type the organisation name to confirm' over a message.",
    "updateOrganizationSettings":
        "The letterhead, bank details and VAT number. A typo goes onto every invoice from then "
        "on, and nobody proofreads on a phone.",
    "saveWhatsAppContact":
        "The assistant's own access list. Granting assistant access through the assistant widens "
        "access with nobody at a keyboard.",
    "deleteWhatsAppContact": "Same list, same reason.",
    "setStartingBalance":
        "Not an operation but a correction of the books, which belongs where the ledger it "
        "rewrites can be seen beside it.",
    "cancelInvitation":
        "An invitation nobody accepted expires on its own; withdrawing one early is desk work.",
    "deleteReport":
        "Tidying the report history. The reports themselves are all reachable; the list of past "
        "runs is housekeeping.",
    "markNotificationAsRead":
        "The in-app notification bell. There is nothing to mark read in a chat.",
    "markAllNotificationsAsRead": "Same bell.",
    "dismissNotification": "Same bell.",
    "getEditRequestDiff":
        "Feeds the approval dialog's three-column view. The assistant lists a pending change and "
        "its reason through list_pending_approvals instead.",
    "getSupplierOwingReport": "Read surface; the assistant has get_expense_breakdown and the creditors report.",
    "getAccounts": "Read surface; covered by get_account_balances.",
    "getOrganizationMembers": "Read surface; covered by list_users.",
    "getPendingInvitations": "Read surface; an invitation nobody accepted is not chat material.",
    "getExpensesForCharts": "Feeds the Analytics tab's charts; the assistant answers with figures, not charts.",
    "getReportHistory": "Read surface; list_reports offers what can be produced, which is the useful half.",
    "getWorkshopMembers": "Feeds the assign dropdown; assign_maintenance_job resolves a worker by name.",
    "getMaintenanceVehicles": "Feeds the create form's vehicle picker; log_maintenance resolves by registration.",
    "getAvailableTrucks": "Feeds an assign dropdown; the assign operations resolve by registration.",
    "getAvailableDrivers": "Feeds an assign dropdown; the assign operations resolve by name.",
    "getUserNotifications": "The in-app bell.",
    "getUnreadNotificationCount": "The in-app bell.",
    "listWhatsAppContacts": "The assistant's own access list — see saveWhatsAppContact.",
    "listLinkableUsers": "Feeds that same list's account picker.",
}

problems = []
checked = 0

# Every assistant operation name that actually exists.
ops = set()
assistant_dir = os.path.join("src", "lib", "assistant")
for filename in os.listdir(assistant_dir):
    if not filename.endswith(".ts"):
        continue
    source = io.open(os.path.join(assistant_dir, filename), encoding="utf-8").read()
    ops |= set(re.findall(r'^\s*name: "([a-z_]+)",', source, re.M))

# Every exported server action in the web app.
actions = {}
for root, _dirs, files in os.walk(os.path.join("src", "app", "(dashboard)")):
    for filename in files:
        if filename != "actions.ts":
            continue
        path = os.path.join(root, filename)
        source = io.open(path, encoding="utf-8").read()
        area = os.path.relpath(root, os.path.join("src", "app", "(dashboard)")).replace(os.sep, "/")
        for match in re.finditer(r"^export async function (\w+)", source, re.M):
            actions.setdefault(match.group(1), []).append(area)

for name, areas in sorted(actions.items()):
    where = ", ".join(sorted(set(areas)))
    if name in COVERED:
        checked += 1
        missing = [op for op in COVERED[name] if op not in ops]
        if missing:
            problems.append(
                f"NO SUCH OP     {name} ({where}) -> {', '.join(missing)} does not exist"
            )
        continue
    if name in WEB_ONLY:
        checked += 1
        continue
    problems.append(
        f"UNACCOUNTED    {name} ({where})  "
        f"(give the assistant an operation, or add it to WEB_ONLY with the reason)"
    )

# An entry that no longer matches any action is stale and hides drift.
for name in sorted(set(COVERED) | set(WEB_ONLY)):
    if name not in actions:
        problems.append(f"STALE ENTRY    {name} is listed here but no such action exists")

print(f"web actions accounted for: {checked}/{len(actions)}")
print(f"assistant operations: {len(ops)}")
if problems:
    print(f"\n{len(problems)} problem(s):")
    for item in problems:
        print("  " + item)
else:
    print("PASS - everything the web app does is reachable from the assistant, or explained")
