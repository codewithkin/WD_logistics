# WD Logistics - Data Requirements

## Core Data Entities

### 1. Users
Central user table for all roles in the system.

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| User ID | Unique identifier | Admin | System |
| Email | Login email | Admin, Self | Admin, Self |
| Password | Encrypted password | None | Admin, Self |
| First Name | User's first name | Admin, Staff, Self | Admin, Self |
| Last Name | User's last name | Admin, Staff, Self | Admin, Self |
| Phone | Contact number | Admin, Staff, Self | Admin, Self |
| Role | User role (admin/staff/driver/accountant/customer) | Admin | Admin |
| Status | Active/Inactive | Admin | Admin |
| Created Date | Account creation date | Admin | System |
| Last Login | Last login timestamp | Admin | System |

---

### 2. Customers
Customer-specific information (extends User for customer role).

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Customer ID | Unique identifier | Admin, Staff, Accountant | System |
| User ID | Link to user account | Admin | System |
| Company Name | Business name (optional) | Admin, Staff, Accountant | Admin, Staff, Self |
| Billing Address | Address for invoices | Admin, Staff, Accountant | Admin, Staff, Self |
| Shipping Address | Default pickup/delivery address | Admin, Staff | Admin, Staff, Self |
| Notes | Internal notes about customer | Admin, Staff | Admin, Staff |

---

### 3. Drivers
Driver-specific information (extends User for driver role).

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Driver ID | Unique identifier | Admin, Staff | System |
| User ID | Link to user account | Admin | System |
| License Number | Driving license number | Admin | Admin |
| License Expiry | License expiration date | Admin | Admin |
| Assigned Vehicle | Currently assigned truck | Admin, Staff, Self | Admin |
| Availability Status | Available/On Delivery/Off Duty | Admin, Staff | Admin, Self |

---

### 4. Vehicles (Trucks)
Fleet/truck information.

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Vehicle ID | Unique identifier | Admin | System |
| Registration Number | License plate | Admin, Staff, Driver (assigned) | Admin |
| Make/Model | Truck make and model | Admin | Admin |
| Capacity | Load capacity (weight/volume) | Admin, Staff | Admin |
| Status | Active/Inactive/Maintenance | Admin | Admin |
| Assigned Driver | Currently assigned driver | Admin, Staff | Admin |
| Notes | Vehicle notes | Admin | Admin |

---

### 5. Orders
Shipping orders placed by customers or staff.

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Order ID | Unique identifier | All (own context) | System |
| Customer ID | Link to customer | Admin, Staff, Accountant | System |
| Order Date | When order was placed | All (own context) | System |
| Status | Pending/Confirmed/Picked Up/In Transit/Delivered/Cancelled | All (own context) | Admin, Staff, Driver (status only) |
| Pickup Address | Where to collect cargo | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff, Customer (if pending) |
| Pickup Date | Scheduled pickup date | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff |
| Pickup Time | Scheduled pickup time | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff |
| Delivery Address | Where to deliver cargo | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff, Customer (if pending) |
| Delivery Date | Expected delivery date | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff |
| Assigned Driver | Driver handling delivery | Admin, Staff, Driver (own only) | Admin, Staff |
| Assigned Vehicle | Vehicle for delivery | Admin, Staff | Admin, Staff |
| Special Instructions | Customer notes | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff, Customer |
| Total Amount | Order total price | Admin, Accountant, Customer (own) | Admin, Staff |
| Created By | User who created order | Admin | System |

---

### 6. Freight/Cargo
Details about items being transported (linked to orders).

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Cargo ID | Unique identifier | Admin, Staff, Driver (assigned) | System |
| Order ID | Link to order | Admin, Staff, Driver (assigned) | System |
| Description | What is being shipped | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff, Customer |
| Weight | Cargo weight | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff, Customer |
| Dimensions | Size (L x W x H) | Admin, Staff, Driver (assigned) | Admin, Staff |
| Quantity | Number of pieces | Admin, Staff, Driver (assigned), Customer (own) | Admin, Staff, Customer |
| Fragile | Is cargo fragile? | Admin, Staff, Driver (assigned) | Admin, Staff, Customer |
| Special Handling | Special requirements | Admin, Staff, Driver (assigned) | Admin, Staff, Customer |

---

### 7. Delivery Updates
Status updates for order tracking.

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Update ID | Unique identifier | Admin, Staff, Driver, Customer (own order) | System |
| Order ID | Link to order | Admin, Staff, Driver, Customer (own order) | System |
| Status | Status at this update | Admin, Staff, Driver, Customer (own order) | System |
| Timestamp | When update occurred | Admin, Staff, Driver, Customer (own order) | System |
| Updated By | Who made the update | Admin, Staff | System |
| Notes | Additional notes | Admin, Staff, Driver (own), Customer (own order) | Driver (when creating) |
| Location | Location at update (optional) | Admin, Staff, Customer (own order) | Driver |

---

### 8. Invoices
Billing documents for completed orders.

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Invoice ID | Unique identifier | Admin, Accountant, Customer (own) | System |
| Invoice Number | Display invoice number | Admin, Accountant, Customer (own) | System |
| Order ID | Link to order | Admin, Accountant, Customer (own) | System |
| Customer ID | Link to customer | Admin, Accountant | System |
| Invoice Date | Date issued | Admin, Accountant, Customer (own) | Accountant |
| Due Date | Payment due date | Admin, Accountant, Customer (own) | Accountant |
| Amount | Total invoice amount | Admin, Accountant, Customer (own) | Accountant |
| Status | Draft/Sent/Paid/Overdue | Admin, Accountant, Customer (own) | Accountant |
| Notes | Invoice notes | Admin, Accountant, Customer (own) | Accountant |
| Created By | Who created invoice | Admin, Accountant | System |

---

### 9. Payments
Payment records for invoices.

| Field | Description | Who Can View | Who Can Edit |
|-------|-------------|--------------|--------------|
| Payment ID | Unique identifier | Admin, Accountant | System |
| Invoice ID | Link to invoice | Admin, Accountant, Customer (own) | System |
| Customer ID | Link to customer | Admin, Accountant | System |
| Payment Date | When payment received | Admin, Accountant, Customer (own) | Accountant |
| Amount | Payment amount | Admin, Accountant, Customer (own) | Accountant |
| Payment Method | Cash/Bank Transfer/etc. | Admin, Accountant | Accountant |
| Reference | Payment reference number | Admin, Accountant | Accountant |
| Notes | Payment notes | Admin, Accountant | Accountant |
| Recorded By | Who recorded payment | Admin, Accountant | System |

---

## Data Access Summary by Role

### Admin
- **Full Access**: All entities, all records
- Can view, create, edit, and delete any data

### Staff
- **Full Access**: Orders, Freight, Delivery Updates
- **Create/View/Edit**: Customers (not delete)
- **View Only**: Drivers, Vehicles
- **No Access**: Invoices, Payments, User Management

### Driver
- **View Only (Assigned)**: Own orders, own cargo, own vehicle
- **Create/Edit**: Delivery updates for assigned orders
- **View/Edit**: Own profile
- **No Access**: Other orders, financial data, other users

### Accountant
- **Full Access**: Invoices, Payments
- **View Only**: Orders (for invoicing), Customers (billing info)
- **No Access**: Drivers, Vehicles, User Management

### Customer
- **View/Edit (Own)**: Own orders, own profile
- **View Only (Own)**: Own invoices, own payments
- **No Access**: Other customers, internal operations

---

## Data Relationships

```
Users
  │
  ├── Customers (1:1 for customer role)
  │     └── Orders (1:many)
  │           ├── Freight/Cargo (1:many)
  │           ├── Delivery Updates (1:many)
  │           └── Invoices (1:1)
  │                 └── Payments (1:many)
  │
  ├── Drivers (1:1 for driver role)
  │     └── Orders (assigned, 1:many)
  │
  └── Vehicles
        └── Drivers (assigned, 1:1)
        └── Orders (assigned, 1:many)
```
