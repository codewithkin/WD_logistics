# WD Logistics - Project Structure

## Overview

This document outlines the project organization across all applications.

---

## Repository Structure

```
WD_logistics/
│
├── docs/                          # Project documentation
│   ├── 01-project-overview.md
│   ├── 02-roles-and-permissions.md
│   ├── 03-features-by-role.md
│   ├── 04-application-pages.md
│   ├── 05-data-requirements.md
│   ├── 06-user-workflows.md
│   ├── 07-mvp-scope.md
│   └── 08-project-structure.md
│
├── backend/                       # Hono API Server
│   └── (API code)
│
├── web/                           # Next.js Web Application
│   └── (Web app code - Staff, Accountant, Customer)
│
├── mobile/                        # Expo React Native Apps
│   ├── apps/
│   │   ├── admin/                 # Admin mobile app
│   │   └── driver/                # Driver mobile app
│   └── packages/
│       └── shared/                # Shared mobile code
│
└── README.md
```

---

## Backend (Hono API)

The backend serves all applications with a unified API.

### Key Responsibilities
- User authentication and authorization
- Role-based access control
- CRUD operations for all entities
- Business logic validation
- Data relationships management

### API Endpoint Groups
| Group | Purpose |
|-------|---------|
| /auth | Login, logout, password reset |
| /users | User management (admin only) |
| /customers | Customer data |
| /drivers | Driver data |
| /vehicles | Fleet management |
| /orders | Order CRUD and status |
| /cargo | Freight/cargo details |
| /invoices | Invoice management |
| /payments | Payment records |

---

## Web Application (Next.js)

Single Next.js application serving three user types with role-based routing.

### Route Structure

```
/                           # Landing page (public)
/login                      # Login page
/register                   # Customer registration

/dashboard                  # Role-based dashboard redirect

# Staff Routes
/staff/dashboard
/staff/orders
/staff/orders/[id]
/staff/orders/new
/staff/drivers
/staff/customers
/staff/customers/new
/staff/schedule
/staff/profile

# Accountant Routes
/accountant/dashboard
/accountant/invoices
/accountant/invoices/[id]
/accountant/invoices/new
/accountant/payments
/accountant/payments/new
/accountant/customers
/accountant/profile

# Customer Routes
/customer/dashboard
/customer/orders
/customer/orders/[id]
/customer/orders/new
/customer/track/[id]
/customer/invoices
/customer/invoices/[id]
/customer/profile
```

---

## Mobile Applications (Expo/React Native)

Two separate apps sharing common code through a shared package.

### Admin App Structure

```
mobile/apps/admin/
├── app/                    # Expo Router pages
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/
│   │   ├── index.tsx           # Dashboard
│   │   ├── orders/
│   │   │   ├── index.tsx       # Order list
│   │   │   ├── [id].tsx        # Order detail
│   │   │   └── new.tsx         # Create order
│   │   ├── users/
│   │   │   ├── index.tsx       # User list
│   │   │   ├── [id].tsx        # User detail
│   │   │   └── new.tsx         # Create user
│   │   ├── fleet/
│   │   │   ├── index.tsx       # Vehicle list
│   │   │   ├── [id].tsx        # Vehicle detail
│   │   │   └── new.tsx         # Add vehicle
│   │   └── profile.tsx
│   └── _layout.tsx
├── components/
├── hooks/
├── services/
└── utils/
```

### Driver App Structure

```
mobile/apps/driver/
├── app/                    # Expo Router pages
│   ├── (auth)/
│   │   ├── login.tsx
│   │   └── forgot-password.tsx
│   ├── (tabs)/
│   │   ├── index.tsx           # Dashboard
│   │   ├── deliveries/
│   │   │   ├── index.tsx       # Delivery list
│   │   │   └── [id].tsx        # Delivery detail
│   │   └── profile.tsx
│   └── _layout.tsx
├── components/
├── hooks/
├── services/
└── utils/
```

### Shared Mobile Package

```
mobile/packages/shared/
├── components/             # Shared UI components
├── hooks/                  # Shared custom hooks
├── services/               # API service layer
├── types/                  # TypeScript types
├── utils/                  # Utility functions
└── constants/              # Shared constants
```

---

## Shared Concepts Across Apps

### Authentication Flow
1. User enters email/password
2. API validates credentials
3. API returns JWT token with role info
4. App stores token securely
5. All subsequent requests include token
6. App redirects based on role

### Data Fetching Pattern
1. Component mounts or action triggered
2. Call API service function
3. API service includes auth token
4. Handle loading state
5. Handle success (update UI)
6. Handle error (show message)

### Role-Based Access Pattern
1. User logs in
2. Role stored in app state
3. Navigation shows role-appropriate menus
4. Routes protected by role middleware
5. API enforces role permissions

---

## Application Entry Points

| App | Platform | Entry Point |
|-----|----------|-------------|
| Web (All web users) | Browser | web/ → Next.js |
| Admin App | iOS/Android | mobile/apps/admin/ |
| Driver App | iOS/Android | mobile/apps/driver/ |
| Backend API | Server | backend/ |

---

## Environment Considerations

### Development
- All apps run locally
- Shared local database
- Hot reloading enabled
- Debug logging active

### Staging/Demo
- Deployed to staging environment
- Sample data loaded
- Password protection for demo

### Production (Future)
- Full deployment
- Real data
- Security hardened
- Monitoring enabled
