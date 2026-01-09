# WD Logistics - Database Schema

## Overview

This document outlines the complete database schema for WD Logistics using Prisma ORM with PostgreSQL.

## Entity Relationship Diagram

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Organization│────<│     User     │>────│    Session   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │
       │                    │
       ▼                    ▼
┌──────────────┐     ┌──────────────┐
│    Member    │     │  EditRequest │
└──────────────┘     └──────────────┘
       │
       │
       ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Truck     │────<│     Trip     │>────│   Customer   │
└──────────────┘     └──────────────┘     └──────────────┘
       │                    │                    │
       │                    │                    │
       ▼                    ▼                    ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│TruckExpense  │     │ TripExpense  │     │   Invoice    │
└──────────────┘     └──────────────┘     └──────────────┘
       │                                         │
       │                                         │
       ▼                                         ▼
┌──────────────┐                          ┌──────────────┐
│   Expense    │                          │   Payment    │
│   Category   │                          └──────────────┘
└──────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│    Driver    │     │   Employee   │     │InventoryItem│
└──────────────┘     └──────────────┘     └──────────────┘
                                                 │
                                                 ▼
                                          ┌──────────────┐
                                          │PartAllocation│
                                          └──────────────┘
```

## Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ============================================
// BETTER-AUTH MODELS
// ============================================

model User {
  id                String    @id @default(cuid())
  email             String    @unique
  emailVerified     Boolean   @default(false)
  name              String
  image             String?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
  
  sessions          Session[]
  accounts          Account[]
  members           Member[]
  editRequests      EditRequest[]  @relation("RequestedBy")
  approvedEdits     EditRequest[]  @relation("ApprovedBy")
  
  @@map("users")
}

model Session {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  ipAddress String?
  userAgent String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("sessions")
}

model Account {
  id                    String    @id @default(cuid())
  userId                String
  accountId             String
  providerId            String
  accessToken           String?
  refreshToken          String?
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  idToken               String?
  password              String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt
  
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@map("accounts")
}

model Verification {
  id         String   @id @default(cuid())
  identifier String
  value      String
  expiresAt  DateTime
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  
  @@map("verifications")
}

// ============================================
// ORGANIZATION (WD LOGISTICS COMPANY)
// ============================================

model Organization {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  logo        String?
  metadata    Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  members     Member[]
  trucks      Truck[]
  drivers     Driver[]
  employees   Employee[]
  customers   Customer[]
  trips       Trip[]
  expenses    Expense[]
  expenseCategories ExpenseCategory[]
  invoices    Invoice[]
  inventory   InventoryItem[]
  reports     Report[]
  
  @@map("organizations")
}

model Member {
  id             String   @id @default(cuid())
  organizationId String
  userId         String
  role           Role     @default(STAFF)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([organizationId, userId])
  @@map("members")
}

enum Role {
  ADMIN
  SUPERVISOR
  STAFF
}

// ============================================
// EDIT REQUEST SYSTEM (For Staff Edits)
// ============================================

model EditRequest {
  id             String          @id @default(cuid())
  entityType     String          // e.g., "truck", "driver", "expense"
  entityId       String
  originalData   Json
  proposedData   Json
  reason         String
  status         EditStatus      @default(PENDING)
  requestedById  String
  approvedById   String?
  approvedAt     DateTime?
  rejectionReason String?
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  
  requestedBy    User            @relation("RequestedBy", fields: [requestedById], references: [id])
  approvedBy     User?           @relation("ApprovedBy", fields: [approvedById], references: [id])
  
  @@map("edit_requests")
}

enum EditStatus {
  PENDING
  APPROVED
  REJECTED
}

// ============================================
// TRUCK MANAGEMENT
// ============================================

model Truck {
  id              String   @id @default(cuid())
  organizationId  String
  registrationNo  String   // e.g., "AEU-29"
  make            String
  model           String
  year            Int
  chassisNumber   String?
  engineNumber    String?
  status          TruckStatus @default(ACTIVE)
  currentMileage  Int      @default(0)
  fuelType        String?
  tankCapacity    Float?
  image           String?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trips           Trip[]
  expenses        TruckExpense[]
  partAllocations PartAllocation[]
  assignedDriver  Driver?  @relation("AssignedTruck")
  
  @@unique([organizationId, registrationNo])
  @@map("trucks")
}

enum TruckStatus {
  ACTIVE
  IN_SERVICE
  IN_REPAIR
  INACTIVE
  DECOMMISSIONED
}

model TruckExpense {
  id          String   @id @default(cuid())
  truckId     String
  expenseId   String
  
  truck       Truck    @relation(fields: [truckId], references: [id], onDelete: Cascade)
  expense     Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  
  @@unique([truckId, expenseId])
  @@map("truck_expenses")
}

// ============================================
// DRIVER MANAGEMENT
// ============================================

model Driver {
  id              String   @id @default(cuid())
  organizationId  String
  firstName       String
  lastName        String
  email           String?
  phone           String
  whatsappNumber  String?  // For WhatsApp notifications
  passportNumber  String?
  licenseNumber   String
  licenseExpiry   DateTime?
  dateOfBirth     DateTime?
  address         String?
  image           String?
  startDate       DateTime @default(now())
  endDate         DateTime?
  status          DriverStatus @default(ACTIVE)
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  assignedTruckId String?  @unique
  assignedTruck   Truck?   @relation("AssignedTruck", fields: [assignedTruckId], references: [id])
  trips           Trip[]
  
  @@map("drivers")
}

enum DriverStatus {
  ACTIVE
  ON_LEAVE
  SUSPENDED
  TERMINATED
}

// ============================================
// EMPLOYEE MANAGEMENT
// ============================================

model Employee {
  id              String   @id @default(cuid())
  organizationId  String
  firstName       String
  lastName        String
  email           String?
  phone           String
  position        String
  department      String?
  image           String?
  idNumber        String?
  address         String?
  emergencyContact String?
  startDate       DateTime @default(now())
  endDate         DateTime?  // Date of dismissal
  dismissalReason String?
  status          EmployeeStatus @default(ACTIVE)
  salary          Float?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  partAllocations PartAllocation[]
  
  @@map("employees")
}

enum EmployeeStatus {
  ACTIVE
  ON_LEAVE
  SUSPENDED
  TERMINATED
}

// ============================================
// CUSTOMER MANAGEMENT
// ============================================

model Customer {
  id              String   @id @default(cuid())
  organizationId  String
  name            String   // e.g., "National Foods"
  contactPerson   String?
  email           String?
  phone           String?
  address         String?
  taxId           String?
  paymentTerms    Int      @default(30) // Days
  creditLimit     Float?
  balance         Float    @default(0)  // Outstanding balance
  notes           String?
  status          CustomerStatus @default(ACTIVE)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  trips           Trip[]
  invoices        Invoice[]
  payments        Payment[]
  
  @@map("customers")
}

enum CustomerStatus {
  ACTIVE
  INACTIVE
  SUSPENDED
}

// ============================================
// TRIP MANAGEMENT
// ============================================

model Trip {
  id                String   @id @default(cuid())
  organizationId    String
  truckId           String
  driverId          String
  customerId        String?
  
  // Route Information
  originCity        String   // e.g., "Harare"
  originAddress     String?
  destinationCity   String   // e.g., "Beira"
  destinationAddress String?
  
  // Load Information
  loadDescription   String?
  loadWeight        Float?   // in kg
  loadUnits         Int?     // Number of units
  
  // Mileage Tracking
  estimatedMileage  Int      // Captured when entering into system
  actualMileage     Int?
  startOdometer     Int?
  endOdometer       Int?
  
  // Financial
  revenue           Float    @default(0)
  
  // Status & Dates
  status            TripStatus @default(SCHEDULED)
  scheduledDate     DateTime
  startDate         DateTime?
  endDate           DateTime?
  
  // Notifications
  driverNotified    Boolean  @default(false)
  notifiedAt        DateTime?
  
  notes             String?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  
  organization      Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  truck             Truck        @relation(fields: [truckId], references: [id])
  driver            Driver       @relation(fields: [driverId], references: [id])
  customer          Customer?    @relation(fields: [customerId], references: [id])
  expenses          TripExpense[]
  
  @@map("trips")
}

enum TripStatus {
  SCHEDULED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model TripExpense {
  id          String   @id @default(cuid())
  tripId      String
  expenseId   String
  
  trip        Trip     @relation(fields: [tripId], references: [id], onDelete: Cascade)
  expense     Expense  @relation(fields: [expenseId], references: [id], onDelete: Cascade)
  
  @@unique([tripId, expenseId])
  @@map("trip_expenses")
}

// ============================================
// EXPENSE MANAGEMENT
// ============================================

model ExpenseCategory {
  id              String   @id @default(cuid())
  organizationId  String
  name            String   // e.g., "Toll Fees", "Fuel", "Tires", "Service", "Repairs"
  description     String?
  isTrip          Boolean  @default(false)  // If true, can be allocated to trips
  isTruck         Boolean  @default(false)  // If true, can be allocated to trucks
  color           String?  // For UI display
  icon            String?  // Icon name for UI
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  expenses        Expense[]
  
  @@unique([organizationId, name])
  @@map("expense_categories")
}

model Expense {
  id              String   @id @default(cuid())
  organizationId  String
  categoryId      String
  amount          Float
  description     String?
  date            DateTime @default(now())
  receiptUrl      String?  // URL to receipt image
  vendor          String?
  reference       String?  // Reference number
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  category        ExpenseCategory @relation(fields: [categoryId], references: [id])
  truckExpenses   TruckExpense[]
  tripExpenses    TripExpense[]
  
  @@map("expenses")
}

// ============================================
// INVOICE & PAYMENT MANAGEMENT
// ============================================

model Invoice {
  id              String   @id @default(cuid())
  organizationId  String
  customerId      String
  invoiceNumber   String
  
  // Financial
  subtotal        Float
  tax             Float    @default(0)
  total           Float
  amountPaid      Float    @default(0)
  balance         Float    // Remaining balance
  
  // Dates
  issueDate       DateTime @default(now())
  dueDate         DateTime
  maxReminderDate DateTime?  // Enter a max date then send reminder
  
  // Status
  status          InvoiceStatus @default(DRAFT)
  
  // Reminders
  reminderSent    Boolean  @default(false)
  reminderSentAt  DateTime?
  
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  customer        Customer     @relation(fields: [customerId], references: [id])
  lineItems       InvoiceLineItem[]
  payments        Payment[]
  
  @@unique([organizationId, invoiceNumber])
  @@map("invoices")
}

enum InvoiceStatus {
  DRAFT
  SENT
  PAID
  PARTIAL
  OVERDUE
  CANCELLED
}

model InvoiceLineItem {
  id          String   @id @default(cuid())
  invoiceId   String
  description String
  quantity    Int      @default(1)
  unitPrice   Float
  total       Float
  
  invoice     Invoice  @relation(fields: [invoiceId], references: [id], onDelete: Cascade)
  
  @@map("invoice_line_items")
}

model Payment {
  id          String   @id @default(cuid())
  invoiceId   String
  customerId  String
  amount      Float
  paymentDate DateTime @default(now())
  method      PaymentMethod
  reference   String?
  notes       String?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  invoice     Invoice  @relation(fields: [invoiceId], references: [id])
  customer    Customer @relation(fields: [customerId], references: [id])
  
  @@map("payments")
}

enum PaymentMethod {
  CASH
  BANK_TRANSFER
  CHECK
  MOBILE_MONEY
  OTHER
}

// ============================================
// INVENTORY MANAGEMENT (Expandable System)
// ============================================

model InventoryItem {
  id              String   @id @default(cuid())
  organizationId  String
  name            String   // e.g., "Airbag"
  sku             String?
  category        String?  // e.g., "Tires", "Brake Parts", "Air System"
  quantity        Int      @default(0)
  minQuantity     Int      @default(5)  // Reorder threshold
  unitCost        Float?
  location        String?  // Storeroom location
  supplier        String?
  notes           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  allocations     PartAllocation[]
  
  @@unique([organizationId, sku])
  @@map("inventory_items")
}

model PartAllocation {
  id              String   @id @default(cuid())
  inventoryItemId String
  truckId         String
  allocatedById   String   // Employee who allocated
  quantity        Int      @default(1)
  reason          String?
  allocatedAt     DateTime @default(now())
  
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id])
  truck           Truck         @relation(fields: [truckId], references: [id])
  allocatedBy     Employee      @relation(fields: [allocatedById], references: [id])
  
  @@map("part_allocations")
}

// ============================================
// REPORT GENERATION
// ============================================

model Report {
  id              String   @id @default(cuid())
  organizationId  String
  type            ReportType
  period          ReportPeriod
  startDate       DateTime
  endDate         DateTime
  format          ReportFormat
  fileUrl         String?
  generatedById   String
  createdAt       DateTime @default(now())
  
  organization    Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  
  @@map("reports")
}

enum ReportType {
  PROFIT_PER_UNIT
  REVENUE
  EXPENSES
  OVERALL
  TIRES
  CUSTOMER_STATEMENT
  TRIP_SUMMARY
  TRUCK_PERFORMANCE
}

enum ReportPeriod {
  DAILY
  WEEKLY
  MONTHLY
  QUARTERLY
  YEARLY
  CUSTOM
}

enum ReportFormat {
  PDF
  CSV
}

// ============================================
// NOTIFICATION LOG
// ============================================

model Notification {
  id              String   @id @default(cuid())
  type            NotificationType
  recipientPhone  String
  message         String
  status          NotificationStatus @default(PENDING)
  sentAt          DateTime?
  error           String?
  metadata        Json?    // Additional data like tripId, invoiceId
  createdAt       DateTime @default(now())
  
  @@map("notifications")
}

enum NotificationType {
  TRIP_ASSIGNMENT
  INVOICE_REMINDER
  PAYMENT_RECEIVED
  GENERAL
}

enum NotificationStatus {
  PENDING
  SENT
  FAILED
}
```

## Database Indexes (Recommended)

```prisma
// Add to relevant models for performance

// Trucks
@@index([organizationId, status])

// Trips
@@index([organizationId, status])
@@index([organizationId, scheduledDate])
@@index([driverId, status])

// Expenses
@@index([organizationId, date])
@@index([categoryId])

// Invoices
@@index([organizationId, status])
@@index([customerId, status])
@@index([dueDate])

// Payments
@@index([customerId])
@@index([paymentDate])
```

## Seed Data Categories

Default expense categories to seed:

| Category | Trip Expense | Truck Expense |
|----------|--------------|---------------|
| Fuel | ✅ | ✅ |
| Toll Fees | ✅ | ❌ |
| Border Fees | ✅ | ❌ |
| Accommodation | ✅ | ❌ |
| Tires | ❌ | ✅ |
| Service | ❌ | ✅ |
| Repairs | ❌ | ✅ |
| Insurance | ❌ | ✅ |
| License & Permits | ❌ | ✅ |
| Parts & Accessories | ❌ | ✅ |
