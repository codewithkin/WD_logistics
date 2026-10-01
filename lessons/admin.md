<img src="../app/public/logo.png" alt="WD Logistics" width="96" />

# WD Logistics — Guide for Admins

You have full access to the system — everything supervisors and staff can do, plus the things that need one person accountable for them: reports, user accounts, organization settings, and the AI assistant.

## What you can do

- Everything in the [Supervisor guide](./supervisor.md) (fleet, trips, customers, suppliers, expenses, invoices, payments), plus:
- Delete records.
- Generate and download reports (profit per unit, revenue, expenses, customer statements, and more).
- Create user accounts and set their role (staff, supervisor, admin).
- Approve or reject Edit Requests. **You are the only one who can** — a supervisor's own changes come to you as well as a staff member's.
- Configure organization settings and connect WhatsApp.
- Use the built-in AI Assistant to ask quick questions about the business.

There's nothing hidden from you — if you don't see something, it's a bug, not a permission.

## Key actions

### 1. Invite a new user

1. Go to **Users → Invite**.
2. Enter their email and choose their role — **staff** (day-to-day entry; any change to an existing record needs your approval), **supervisor** (runs operations and sees costs, never revenue or profit; changes also need your approval), **workshop** (only the maintenance jobs assigned to them), or **admin** (everything).
3. They'll get an email invite to set up their account.

### 2. Generate a report

1. Go to **Reports** in the sidebar.
2. Pick the report type (e.g. Profit Per Unit, Revenue, Customer Statement) and a time period.
3. Generate as PDF or CSV — it's saved and downloadable afterward too.

### 3. Approve an Edit Request

Same as the supervisor flow: **Edit Requests** in the sidebar shows what staff have asked to change, with the original and proposed data side-by-side. Approve to apply it, reject with a reason to send it back.

### 4. Connect WhatsApp

1. Go to **Settings → WhatsApp**.
2. Click connect and scan the QR code shown with the business WhatsApp number's phone.
3. Once connected, the system can send trip assignments to drivers and payment reminders to customers automatically — you don't need to do this per-message.

### 5. Ask the AI Assistant a quick question

1. Go to **AI Assistant** in the sidebar.
2. Ask things like "how many trips today" or "any overdue invoices" — it pulls live numbers from the system rather than guessing.
3. It's read-only: it can tell you things, but it won't change any data.

### 6. Adjust organization settings

**Settings** covers the company profile (name, logo, contact details), expense categories, and a few feature toggles. Changes here apply organization-wide immediately.

### 7. Start the system afresh

Settings → General → **Reset Everything**. Any admin can run it. It permanently
removes every trip, truck, trailer, driver, customer, supplier, invoice,
payment, expense, stock item, employee, report, edit request, notification,
company-profile field, finance account, category, WhatsApp contact and
conversation. It also deletes every other account in this organisation.

Only the seeded administrator account remains. The organisation row stays
only as the shell required for that account to sign in; its name, logo,
letterhead, bank details, VAT number and other profile settings are cleared.
The WhatsApp device is logged out and unpaired, so scan a new QR code under
Settings → WhatsApp before using it again.

There is no undo. Type `DELETE ALL DATA` to confirm, and afterwards invite the
real team and rebuild the company profile from Settings.

### The root account

One email is the root: `admin@wd-logistics.co.zw`. It is an ordinary admin in
every respect except three:

- no other admin can change its password, demote it or remove it;
- it is the account a reset leaves standing.

Everyone else's password can still be set or reset by any admin, including
other admins'. Change the root's password at the first sign-in — Settings →
Account — because the one it ships with is deliberately simple.

## A note on scope

Being able to do everything doesn't mean you have to review everything — day-to-day fleet and finance entries are exactly what supervisors are for. Your extra access exists for the handful of things (reports, accounts, settings) that specifically need one accountable owner.
