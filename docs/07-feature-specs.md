# WD Logistics - Feature Specifications

## Overview

This document provides detailed specifications for all features in the WD Logistics system.

## 1. Dashboard

### Admin Dashboard

```
┌────────────────────────────────────────────────────────────────────┐
│                         DASHBOARD                                   │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐  │
│  │ Active      │ │ Trips       │ │ Revenue     │ │ Pending     │  │
│  │ Trucks      │ │ This Month  │ │ This Month  │ │ Requests    │  │
│  │     12      │ │     45      │ │   $125,000  │ │      3      │  │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘  │
│                                                                     │
│  ┌────────────────────────────────┐ ┌───────────────────────────┐  │
│  │    Revenue vs Expenses Chart   │ │   Fleet Status Pie Chart  │  │
│  │    [Line/Bar Chart]            │ │   [Pie Chart]             │  │
│  │                                │ │   - Active: 10            │  │
│  │                                │ │   - In Service: 2         │  │
│  │                                │ │   - In Repair: 1          │  │
│  └────────────────────────────────┘ └───────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────┐ ┌───────────────────────────┐  │
│  │      Recent Trips              │ │   Pending Edit Requests   │  │
│  │  ┌─────────────────────────┐   │ │  ┌─────────────────────┐  │  │
│  │  │ Harare → Beira (AEU-29) │   │ │  │ Truck AEU-30 Edit   │  │  │
│  │  │ Driver: John M.         │   │ │  │ By: Staff User      │  │  │
│  │  │ Status: In Progress     │   │ │  │ [Review]            │  │  │
│  │  └─────────────────────────┘   │ │  └─────────────────────┘  │  │
│  └────────────────────────────────┘ └───────────────────────────┘  │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐│
│  │                    Overdue Invoices Alert                       ││
│  │  3 invoices are overdue totaling $15,500 [View All]            ││
│  └────────────────────────────────────────────────────────────────┘│
└────────────────────────────────────────────────────────────────────┘
```

### Dashboard Components

```typescript
// Types for dashboard data
interface DashboardStats {
  activeTrucks: number;
  totalTrucks: number;
  tripsThisMonth: number;
  tripsLastMonth: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  expensesThisMonth: number;
  pendingEditRequests: number;
  overdueInvoices: number;
  overdueAmount: number;
}

interface RecentTrip {
  id: string;
  route: string;
  truck: string;
  driver: string;
  status: TripStatus;
  scheduledDate: Date;
}

interface FleetStatus {
  active: number;
  inService: number;
  inRepair: number;
  inactive: number;
}
```

---

## 2. Fleet Management

### 2.1 Truck Management

#### Truck List View

| Feature | Description |
|---------|-------------|
| Search | Search by registration, make, model |
| Filter | Filter by status (Active, In Service, etc.) |
| Sort | Sort by registration, mileage, last trip |
| Actions | View, Edit, Delete (role-based) |

#### Truck Form Fields

```typescript
interface TruckFormData {
  registrationNo: string;      // Required, unique
  make: string;                // Required (e.g., Volvo, Scania)
  model: string;               // Required (e.g., FH16)
  year: number;                // Required
  chassisNumber?: string;
  engineNumber?: string;
  status: TruckStatus;         // Required
  currentMileage: number;      // Required
  fuelType?: string;           // Diesel, Petrol
  tankCapacity?: number;       // Liters
  image?: File;                // Upload
  notes?: string;
}
```

#### Truck Detail View

Shows:
- Basic information
- Current driver assignment
- Recent trips (last 10)
- Expense history
- Part allocations
- Performance metrics

### 2.2 Driver Management

#### Driver Form Fields

```typescript
interface DriverFormData {
  firstName: string;           // Required
  lastName: string;            // Required
  email?: string;
  phone: string;               // Required
  whatsappNumber?: string;     // For notifications
  passportNumber?: string;
  licenseNumber: string;       // Required
  licenseExpiry?: Date;
  dateOfBirth?: Date;
  address?: string;
  image?: File;                // Photo upload
  startDate: Date;             // Required - employment start
  endDate?: Date;              // If terminated
  status: DriverStatus;        // Required
  assignedTruckId?: string;    // Assign to truck
  notes?: string;
}
```

#### Driver Features

- License expiry alerts
- Trip history
- Performance metrics
- WhatsApp notification toggle

---

## 3. Trip Management

### Trip Creation Flow

```
1. Select Truck
   └── Shows available trucks only
   
2. Select Driver
   └── Shows available drivers (not on active trip)
   
3. Route Details
   ├── Origin City & Address
   └── Destination City & Address
   
4. Schedule
   ├── Scheduled Date
   └── Estimated Mileage (required)
   
5. Load Information
   ├── Load Description
   ├── Load Weight (optional)
   └── Number of Units (optional)
   
6. Customer (optional)
   └── Select from customer list
   
7. Revenue
   └── Expected revenue for this trip
   
8. Review & Create
   └── Option to notify driver immediately
```

### Trip Lifecycle

```
SCHEDULED → IN_PROGRESS → COMPLETED
     │                         │
     └──── CANCELLED ──────────┘

Status Transitions:
- SCHEDULED: Trip is planned
- IN_PROGRESS: Driver has started (captures start odometer)
- COMPLETED: Driver finished (captures end odometer, actual mileage)
- CANCELLED: Trip was cancelled
```

### Trip Form Fields

```typescript
interface TripFormData {
  truckId: string;             // Required
  driverId: string;            // Required
  customerId?: string;
  
  // Route
  originCity: string;          // Required
  originAddress?: string;
  destinationCity: string;     // Required
  destinationAddress?: string;
  
  // Schedule
  scheduledDate: Date;         // Required
  estimatedMileage: number;    // Required
  
  // Load
  loadDescription?: string;
  loadWeight?: number;
  loadUnits?: number;
  
  // Financial
  revenue?: number;
  
  // Options
  notifyDriver?: boolean;      // Send WhatsApp notification
}
```

### Trip Expense Allocation

When recording trip expenses:
1. Select trip
2. Add expense with category (Toll Fees, Fuel, Border Fees, etc.)
3. Expense is linked to both trip and truck

---

## 4. Expense Management

### Expense Categories

Pre-configured categories:

| Category | Trip Expense | Truck Expense | Icon | Color |
|----------|--------------|---------------|------|-------|
| Fuel | ✅ | ✅ | ⛽ | Red |
| Toll Fees | ✅ | ❌ | 🛣️ | Orange |
| Border Fees | ✅ | ❌ | 🛂 | Green |
| Accommodation | ✅ | ❌ | 🏨 | Blue |
| Tires | ❌ | ✅ | 🔘 | Indigo |
| Service | ❌ | ✅ | 🔧 | Purple |
| Repairs | ❌ | ✅ | 🛠️ | Pink |
| Insurance | ❌ | ✅ | 📋 | Teal |
| License & Permits | ❌ | ✅ | 📝 | Orange |
| Parts & Accessories | ❌ | ✅ | 🔩 | Lime |

### Expense Flow

```
Add Expense
    │
    ├── Select Category
    │
    ├── Enter Amount
    │
    ├── Enter Date
    │
    ├── Allocate To:
    │   ├── Trip (for trip expenses)
    │   └── Truck (for truck expenses)
    │
    ├── Upload Receipt (optional)
    │
    └── Add Notes (optional)
```

### Expense Form

```typescript
interface ExpenseFormData {
  categoryId: string;          // Required
  amount: number;              // Required
  description?: string;
  date: Date;                  // Required
  receipt?: File;              // Upload
  vendor?: string;
  reference?: string;
  notes?: string;
  
  // Allocation
  truckId?: string;            // If truck expense
  tripId?: string;             // If trip expense
}
```

### Non-Expense Allocations

For service and repairs that are tracked but not as expenses:

```typescript
interface ServiceRecord {
  truckId: string;
  type: "SERVICE" | "REPAIR";
  description: string;
  date: Date;
  mileage: number;
  notes?: string;
  // These don't have an amount - they're for tracking only
}
```

---

## 5. Customer Management

### Customer Form

```typescript
interface CustomerFormData {
  name: string;                // Required (e.g., "National Foods")
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  paymentTerms: number;        // Days (default: 30)
  creditLimit?: number;
  status: CustomerStatus;
  notes?: string;
}
```

### Customer Features

1. **Account Balance Tracking**
   - Automatic balance calculation
   - Invoice vs Payment reconciliation

2. **Statement Generation**
   - Select date range
   - Shows all invoices and payments
   - Running balance calculation
   - PDF export with branding

3. **Trip History**
   - All trips for this customer
   - Revenue generated

4. **Credit Management**
   - Set credit limit
   - Alert when approaching limit

---

## 6. Invoice Management

### Invoice Creation

```
1. Select Customer
   └── Shows customer details and balance
   
2. Add Line Items
   ├── Description
   ├── Quantity
   ├── Unit Price
   └── [+ Add More]
   
3. Summary
   ├── Subtotal (auto-calculated)
   ├── Tax (configurable %)
   └── Total
   
4. Dates
   ├── Issue Date (default: today)
   ├── Due Date (default: based on payment terms)
   └── Max Reminder Date (for auto-reminders)
   
5. Review & Create
   └── Option to send immediately
```

### Invoice Form

```typescript
interface InvoiceFormData {
  customerId: string;          // Required
  lineItems: {
    description: string;
    quantity: number;
    unitPrice: number;
  }[];
  tax?: number;                // Percentage
  issueDate: Date;
  dueDate: Date;
  maxReminderDate?: Date;      // Stop reminders after this date
  notes?: string;
}
```

### Invoice Actions

| Action | Description | Role |
|--------|-------------|------|
| View | View invoice details | All |
| Edit | Modify invoice | Admin, Supervisor |
| Delete | Delete invoice | Admin, Supervisor |
| Download PDF | Generate PDF | All |
| Record Payment | Add payment | Admin, Supervisor, Staff |
| Send Reminder | WhatsApp reminder | Admin, Supervisor |
| Mark as Sent | Update status | Admin, Supervisor |

### Invoice PDF Template

```
┌─────────────────────────────────────────────────────────────┐
│  [WD Logo]        WD LOGISTICS                              │
│                   INVOICE                                    │
│                                                             │
│  Invoice #: INV-2026-0001                                   │
│  Date: January 9, 2026                                      │
│  Due Date: February 8, 2026                                 │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Bill To:                                                   │
│  National Foods                                             │
│  123 Industrial Road                                        │
│  Harare, Zimbabwe                                           │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Description              Qty    Unit Price    Amount       │
│  ────────────────────────────────────────────────────────  │
│  Transport: Harare-Beira   1      $3,500.00    $3,500.00   │
│  Loading/Unloading         1        $200.00      $200.00   │
│                                                             │
│  ────────────────────────────────────────────────────────  │
│                                   Subtotal:    $3,700.00   │
│                                   Tax (0%):        $0.00   │
│                                   ─────────────────────    │
│                                   TOTAL:       $3,700.00   │
│                                                             │
│  ───────────────────────────────────────────────────────   │
│                                                             │
│  Payment Terms: Net 30                                      │
│  Bank: [Bank Details]                                       │
│                                                             │
│  Thank you for your business!                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 7. Payment Management

### Record Payment

```typescript
interface PaymentFormData {
  invoiceId: string;           // Required
  amount: number;              // Required
  paymentDate: Date;           // Required
  method: PaymentMethod;       // Required
  reference?: string;          // Check number, transfer ref
  notes?: string;
}

enum PaymentMethod {
  CASH = "CASH",
  BANK_TRANSFER = "BANK_TRANSFER",
  CHECK = "CHECK",
  MOBILE_MONEY = "MOBILE_MONEY",
  OTHER = "OTHER"
}
```

### Payment Effects

When a payment is recorded:
1. Invoice `amountPaid` increases
2. Invoice `balance` decreases
3. Customer `balance` decreases
4. Invoice status updates:
   - If fully paid → "PAID"
   - If partially paid → "PARTIAL"

---

## 8. Employee Management

**Admin Only Feature**

### Employee Form

```typescript
interface EmployeeFormData {
  firstName: string;           // Required
  lastName: string;            // Required
  email?: string;
  phone: string;               // Required
  position: string;            // Required
  department?: string;
  image?: File;                // Photo upload
  idNumber?: string;
  address?: string;
  emergencyContact?: string;
  startDate: Date;             // Required
  endDate?: Date;              // Date of dismissal
  dismissalReason?: string;
  status: EmployeeStatus;
  salary?: number;
  notes?: string;
}
```

### Employee Features

- Photo gallery
- Employment history
- Part allocation history (for workshop staff)

---

## 9. Inventory Management (Expandable)

### Inventory Item

```typescript
interface InventoryItemFormData {
  name: string;                // Required (e.g., "Airbag")
  sku?: string;                // Stock Keeping Unit
  category?: string;           // Tires, Brake Parts, etc.
  quantity: number;            // Current stock
  minQuantity: number;         // Reorder threshold
  unitCost?: number;
  location?: string;           // Storeroom location
  supplier?: string;
  notes?: string;
}
```

### Part Allocation Flow

```
1. Select Part
   └── Shows available quantity
   
2. Select Truck
   └── Shows truck registration
   
3. Enter Quantity
   
4. Add Reason
   └── Why this part was allocated
   
5. Confirm
   └── Reduces inventory quantity
```

### Part Allocation

```typescript
interface PartAllocationFormData {
  inventoryItemId: string;     // Required
  truckId: string;             // Required
  quantity: number;            // Required
  reason?: string;
}
```

### Inventory Alerts

- Low stock alerts (below `minQuantity`)
- Out of stock alerts
- Reorder suggestions

---

## 10. Edit Request System

### Request Creation (Staff)

```typescript
interface EditRequestFormData {
  entityType: "truck" | "driver" | "expense" | "trip" | "customer";
  entityId: string;
  proposedData: Record<string, any>;  // Changed fields only
  reason: string;              // Required - why this edit is needed
}
```

### Request Review (Admin)

Admin sees:
- Original data
- Proposed changes (highlighted)
- Reason provided
- Who requested and when

Admin can:
- Approve → Changes applied automatically
- Reject → Must provide rejection reason

### Request Status Flow

```
PENDING → APPROVED
    │
    └── REJECTED
```

---

## 11. Settings (Admin Only)

### Organization Settings

```typescript
interface OrganizationSettings {
  name: string;
  logo?: File;
  address: string;
  phone: string;
  email: string;
  taxId?: string;
  defaultPaymentTerms: number;
  defaultTaxRate: number;
  currency: string;
}
```

### Expense Category Management

- Add new categories
- Edit existing categories
- Set as trip/truck expense
- Choose color and icon

### WhatsApp Settings

- View connection status
- Generate QR code for authentication
- Test message sending

---

## 12. Notifications System

### Notification Types

| Type | Trigger | Recipient |
|------|---------|-----------|
| Trip Assignment | New trip created | Driver (WhatsApp) |
| Invoice Reminder | Overdue invoice | Customer (WhatsApp) |
| Payment Received | Payment recorded | Customer (WhatsApp) |
| Edit Request | New request | Admin (In-app) |
| Edit Approved/Rejected | Admin action | Staff (In-app) |
| Low Stock | Below threshold | Admin (In-app) |
| License Expiry | 30 days before | Admin (In-app) |

### In-App Notification Bell

```tsx
// Notification dropdown in header
interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
  actionUrl?: string;
}
```

---

## 13. Search & Filters

### Global Search

Search across:
- Trucks (registration, make, model)
- Drivers (name, license number)
- Customers (name, contact)
- Trips (route, reference)
- Invoices (invoice number)

### Common Filters

| Entity | Filters |
|--------|---------|
| Trucks | Status, Make, Year |
| Drivers | Status, Assigned/Unassigned |
| Trips | Status, Date Range, Customer, Driver, Truck |
| Expenses | Category, Date Range, Truck, Trip |
| Invoices | Status, Customer, Date Range |
| Payments | Method, Date Range, Customer |

---

## 14. Data Export

### Export Options

| Data | Formats | Filters |
|------|---------|---------|
| Trucks | CSV | Status |
| Drivers | CSV | Status |
| Trips | CSV | Date range, Status |
| Expenses | CSV | Date range, Category |
| Invoices | CSV, PDF | Date range, Status |
| Payments | CSV | Date range |
| Reports | PDF, CSV | Various |

### Bulk Actions

- Export selected items
- Export all with filters applied

---

## 15. Audit Log

Track all changes for compliance:

```typescript
interface AuditLog {
  id: string;
  userId: string;
  action: "CREATE" | "UPDATE" | "DELETE";
  entityType: string;
  entityId: string;
  previousData?: any;
  newData?: any;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}
```

Admin can view audit logs for:
- Who made changes
- What was changed
- When it happened
- Previous vs new values
