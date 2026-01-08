# WD Logistics - User Roles & Permissions

## Role Hierarchy

```
Admin (Highest Access)
    │
    ├── Staff (Operational Access)
    │
    ├── Accountant (Financial Access)
    │
    ├── Driver (Delivery Access)
    │
    └── Customer (Limited Access - External)
```

---

## 1. Admin Role

### Description
The Admin has complete control over the entire system. They oversee all operations, manage staff, and have visibility into every aspect of the business.

### Access Level
- **Full Read/Write** access to all data
- Can create, edit, delete any record
- Can manage all user accounts

### Key Responsibilities
- Manage all staff accounts (create, edit, deactivate)
- Oversee all orders and deliveries
- View and manage fleet (trucks/vehicles)
- Access all financial data
- Handle escalated issues
- Configure system settings

### Data Access
| Data Type | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| Users (all roles) | ✅ | ✅ | ✅ | ✅ |
| Orders | ✅ | ✅ | ✅ | ✅ |
| Freight/Cargo | ✅ | ✅ | ✅ | ✅ |
| Vehicles/Trucks | ✅ | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ | ✅ |
| Payments | ✅ | ✅ | ✅ | ✅ |
| Customers | ✅ | ✅ | ✅ | ✅ |

---

## 2. Staff Role

### Description
Staff members handle day-to-day operations including order processing, scheduling, and customer communication. They work from the web dashboard.

### Access Level
- **Read/Write** access to orders and scheduling
- **Read** access to drivers and vehicles
- **No access** to financial data or user management

### Key Responsibilities
- Process incoming orders
- Assign drivers to deliveries
- Schedule pickups and deliveries
- Update order status
- Handle customer inquiries
- Coordinate with drivers

### Data Access
| Data Type | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| Users | ❌ | ❌ | ❌ | ❌ |
| Orders | ✅ | ✅ | ✅ | ❌ |
| Freight/Cargo | ✅ | ✅ | ✅ | ❌ |
| Vehicles/Trucks | ❌ | ✅ | ❌ | ❌ |
| Drivers (view only) | ❌ | ✅ | ❌ | ❌ |
| Invoices | ❌ | ❌ | ❌ | ❌ |
| Payments | ❌ | ❌ | ❌ | ❌ |
| Customers | ✅ | ✅ | ✅ | ❌ |

---

## 3. Driver Role

### Description
Drivers are responsible for executing deliveries. They use the mobile app to receive assignments, update delivery status, and confirm completions.

### Access Level
- **Read** access to their assigned orders only
- **Write** access to update delivery status
- **No access** to other drivers' orders or financial data

### Key Responsibilities
- View assigned deliveries
- Update pickup/delivery status
- Confirm delivery completion
- Report issues or delays
- View route/destination details

### Data Access
| Data Type | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| Users | ❌ | Own profile only | Own profile only | ❌ |
| Orders (assigned) | ❌ | ✅ | Status only | ❌ |
| Orders (others) | ❌ | ❌ | ❌ | ❌ |
| Freight/Cargo (assigned) | ❌ | ✅ | ❌ | ❌ |
| Vehicles (assigned) | ❌ | ✅ | ❌ | ❌ |
| Invoices | ❌ | ❌ | ❌ | ❌ |
| Payments | ❌ | ❌ | ❌ | ❌ |

---

## 4. Accountant Role

### Description
Accountants manage all financial aspects of the business including invoicing, payments, and financial records.

### Access Level
- **Full Read/Write** access to financial data
- **Read only** access to orders (for invoicing reference)
- **No access** to user management or operations

### Key Responsibilities
- Create and manage invoices
- Record payments received
- Track outstanding balances
- Generate financial summaries
- Manage customer billing

### Data Access
| Data Type | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| Users | ❌ | ❌ | ❌ | ❌ |
| Orders | ❌ | ✅ | ❌ | ❌ |
| Freight/Cargo | ❌ | ✅ | ❌ | ❌ |
| Vehicles/Trucks | ❌ | ❌ | ❌ | ❌ |
| Invoices | ✅ | ✅ | ✅ | ✅ |
| Payments | ✅ | ✅ | ✅ | ❌ |
| Customers (billing) | ❌ | ✅ | Billing info only | ❌ |

---

## 5. Customer Role

### Description
External users who place orders and track their shipments. They have access only to their own data through the web portal.

### Access Level
- **Read/Write** access to their own orders
- **Read** access to their invoices and payment history
- **No access** to internal operations or other customers' data

### Key Responsibilities
- Place new shipping orders
- Track their shipments
- View and pay invoices
- Update their profile/contact information

### Data Access
| Data Type | Create | Read | Update | Delete |
|-----------|--------|------|--------|--------|
| Own Profile | ❌ | ✅ | ✅ | ❌ |
| Own Orders | ✅ | ✅ | Limited | ✅ (if pending) |
| Own Invoices | ❌ | ✅ | ❌ | ❌ |
| Own Payments | ❌ | ✅ | ❌ | ❌ |
| Other Data | ❌ | ❌ | ❌ | ❌ |

---

## Role Comparison Summary

| Feature | Admin | Staff | Driver | Accountant | Customer |
|---------|-------|-------|--------|------------|----------|
| Manage Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| View All Orders | ✅ | ✅ | ❌ | ✅ | ❌ |
| Create Orders | ✅ | ✅ | ❌ | ❌ | ✅ (own) |
| Assign Drivers | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update Delivery Status | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| Manage Vehicles | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create Invoices | ✅ | ❌ | ❌ | ✅ | ❌ |
| Record Payments | ✅ | ❌ | ❌ | ✅ | ❌ |
| View Financial Reports | ✅ | ❌ | ❌ | ✅ | ❌ |
| Track Shipments | ✅ | ✅ | ✅ (own) | ❌ | ✅ (own) |
