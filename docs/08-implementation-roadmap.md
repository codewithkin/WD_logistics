# WD Logistics - Implementation Roadmap

## Overview

This document outlines the implementation phases for the WD Logistics system, from initial setup to full deployment.

## Tech Stack Summary

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 14+ (App Router) |
| Styling | Tailwind CSS + shadcn/ui |
| Authentication | better-auth (Organizations) |
| Database | PostgreSQL |
| ORM | Prisma |
| AI Agent | Mastra.ai |
| WhatsApp | wweb-js |
| Reports | react-pdf + CSV |
| File Storage | AWS S3 / Cloudflare R2 |
| Deployment | Vercel / Railway |

## Phase 1: Foundation (Week 1-2)

### 1.1 Project Setup

```bash
# Create Next.js project
npx create-next-app@latest wd-logistics --typescript --tailwind --app --src-dir

# Install core dependencies
npm install prisma @prisma/client better-auth @better-auth/prisma
npm install zod react-hook-form @hookform/resolvers

# Install shadcn/ui
npx shadcn@latest init
npx shadcn@latest add button card input label form table dialog sheet dropdown-menu badge toast tabs avatar
```

### 1.2 Database Setup

```bash
# Initialize Prisma
npx prisma init

# Create database (PostgreSQL)
# Update DATABASE_URL in .env

# Generate schema from 01-database-schema.md
# Run migration
npx prisma migrate dev --name init
npx prisma generate
```

### 1.3 Authentication Setup

Files to create:
- [ ] `lib/auth.ts` - better-auth configuration
- [ ] `lib/auth-client.ts` - Client-side auth
- [ ] `app/api/auth/[...all]/route.ts` - Auth API routes
- [ ] `middleware.ts` - Route protection
- [ ] `hooks/use-permissions.ts` - Permission hook

### 1.4 Base Layout

Files to create:
- [ ] `app/(auth)/layout.tsx` - Auth pages layout
- [ ] `app/(auth)/login/page.tsx` - Login page
- [ ] `app/(auth)/register/page.tsx` - Register page
- [ ] `app/(dashboard)/layout.tsx` - Dashboard layout
- [ ] `components/layout/sidebar.tsx` - Role-based sidebar
- [ ] `components/layout/header.tsx` - Top header
- [ ] `config/navigation.ts` - Navigation config

### Deliverables
- ✅ Project structure set up
- ✅ Database schema migrated
- ✅ Authentication working
- ✅ Role-based sidebar navigation
- ✅ Protected routes

---

## Phase 2: Core Fleet Management (Week 3-4)

### 2.1 Truck Management

Files to create:
- [ ] `app/(dashboard)/fleet/trucks/page.tsx` - List view
- [ ] `app/(dashboard)/fleet/trucks/new/page.tsx` - Create form
- [ ] `app/(dashboard)/fleet/trucks/[id]/page.tsx` - Detail view
- [ ] `app/(dashboard)/fleet/trucks/[id]/edit/page.tsx` - Edit form
- [ ] `components/trucks/truck-form.tsx` - Reusable form
- [ ] `components/trucks/trucks-table.tsx` - Data table
- [ ] `app/api/trucks/route.ts` - API endpoints
- [ ] `app/api/trucks/[id]/route.ts` - Single truck API
- [ ] `lib/validations/truck.ts` - Zod schemas

### 2.2 Driver Management

Files to create:
- [ ] `app/(dashboard)/fleet/drivers/page.tsx`
- [ ] `app/(dashboard)/fleet/drivers/new/page.tsx`
- [ ] `app/(dashboard)/fleet/drivers/[id]/page.tsx`
- [ ] `app/(dashboard)/fleet/drivers/[id]/edit/page.tsx`
- [ ] `components/drivers/driver-form.tsx`
- [ ] `components/drivers/drivers-table.tsx`
- [ ] `app/api/drivers/route.ts`
- [ ] `app/api/drivers/[id]/route.ts`
- [ ] `lib/validations/driver.ts`

### 2.3 Image Upload

- [ ] Set up cloud storage (S3/R2)
- [ ] `lib/storage.ts` - Upload utilities
- [ ] `components/ui/image-upload.tsx` - Upload component

### Deliverables
- ✅ Full truck CRUD
- ✅ Full driver CRUD
- ✅ Image upload working
- ✅ Driver assignment to trucks

---

## Phase 3: Operations (Week 5-6)

### 3.1 Trip Management

Files to create:
- [ ] `app/(dashboard)/operations/trips/page.tsx`
- [ ] `app/(dashboard)/operations/trips/new/page.tsx`
- [ ] `app/(dashboard)/operations/trips/[id]/page.tsx`
- [ ] `components/trips/trip-form.tsx`
- [ ] `components/trips/trips-table.tsx`
- [ ] `components/trips/trip-status-badge.tsx`
- [ ] `app/api/trips/route.ts`
- [ ] `app/api/trips/[id]/route.ts`
- [ ] `app/api/trips/[id]/status/route.ts` - Status transitions
- [ ] `lib/validations/trip.ts`

### 3.2 Expense Management

Files to create:
- [ ] `app/(dashboard)/operations/expenses/page.tsx`
- [ ] `app/(dashboard)/operations/expenses/new/page.tsx`
- [ ] `components/expenses/expense-form.tsx`
- [ ] `components/expenses/expenses-table.tsx`
- [ ] `components/expenses/category-select.tsx`
- [ ] `app/api/expenses/route.ts`
- [ ] `app/api/expenses/[id]/route.ts`
- [ ] `app/api/expense-categories/route.ts`
- [ ] `lib/validations/expense.ts`

### 3.3 Trip-Expense Linking

- [ ] Expense allocation to trips
- [ ] Expense allocation to trucks
- [ ] Cost breakdown views

### Deliverables
- ✅ Full trip management
- ✅ Trip lifecycle (scheduled → completed)
- ✅ Expense tracking with categories
- ✅ Expense allocation

---

## Phase 4: Customer & Financial (Week 7-8)

### 4.1 Customer Management

Files to create:
- [ ] `app/(dashboard)/customers/page.tsx`
- [ ] `app/(dashboard)/customers/new/page.tsx`
- [ ] `app/(dashboard)/customers/[id]/page.tsx`
- [ ] `components/customers/customer-form.tsx`
- [ ] `components/customers/customers-table.tsx`
- [ ] `components/customers/customer-balance.tsx`
- [ ] `app/api/customers/route.ts`
- [ ] `app/api/customers/[id]/route.ts`
- [ ] `app/api/customers/[id]/statement/route.ts`

### 4.2 Invoice Management

Files to create:
- [ ] `app/(dashboard)/finance/invoices/page.tsx`
- [ ] `app/(dashboard)/finance/invoices/new/page.tsx`
- [ ] `app/(dashboard)/finance/invoices/[id]/page.tsx`
- [ ] `components/invoices/invoice-form.tsx`
- [ ] `components/invoices/invoices-table.tsx`
- [ ] `components/invoices/line-items-editor.tsx`
- [ ] `app/api/invoices/route.ts`
- [ ] `app/api/invoices/[id]/route.ts`
- [ ] `app/api/invoices/[id]/pdf/route.ts`

### 4.3 Payment Management

Files to create:
- [ ] `app/(dashboard)/finance/payments/page.tsx`
- [ ] `components/payments/payment-form.tsx`
- [ ] `components/payments/payments-table.tsx`
- [ ] `app/api/payments/route.ts`
- [ ] `app/api/payments/[id]/route.ts`

### 4.4 Invoice PDF Generation

- [ ] `lib/reports/invoice-pdf.tsx` - Invoice template
- [ ] PDF generation with react-pdf
- [ ] Download functionality

### Deliverables
- ✅ Full customer management
- ✅ Invoice creation and tracking
- ✅ Payment recording
- ✅ Invoice PDF generation
- ✅ Customer statements

---

## Phase 5: Reports System (Week 9-10)

### 5.1 Report Infrastructure

Files to create:
- [ ] `lib/reports/pdf-generator.tsx` - PDF components
- [ ] `lib/reports/csv-generator.ts` - CSV generator
- [ ] `config/reports.ts` - Report configurations
- [ ] `app/api/reports/generate/[type]/route.ts`
- [ ] `app/api/reports/[id]/download/route.ts`

### 5.2 Report Types

Implement each report:
- [ ] Profit Per Unit Report
- [ ] Revenue Report
- [ ] Expense Report
- [ ] Overall Financial Report
- [ ] Tires Report
- [ ] Customer Statement
- [ ] Trip Summary Report
- [ ] Truck Performance Report

### 5.3 Reports UI

Files to create:
- [ ] `app/(dashboard)/reports/page.tsx`
- [ ] `components/reports/report-generator.tsx`
- [ ] `components/reports/report-history.tsx`
- [ ] `components/reports/report-preview.tsx`

### Deliverables
- ✅ All report types working
- ✅ PDF generation with branding
- ✅ CSV export
- ✅ Report history

---

## Phase 6: AI Agent & Notifications (Week 11-12)

### 6.1 WhatsApp Integration

Files to create:
- [ ] `lib/whatsapp/index.ts` - wweb-js client
- [ ] `app/api/whatsapp/status/route.ts`
- [ ] `app/api/whatsapp/initialize/route.ts`
- [ ] `app/api/whatsapp/send/route.ts`
- [ ] `components/settings/whatsapp-status.tsx`

### 6.2 Mastra.ai Setup

Files to create:
- [ ] `lib/mastra/index.ts` - Mastra configuration
- [ ] `lib/mastra/tools/trucks.ts`
- [ ] `lib/mastra/tools/trips.ts`
- [ ] `lib/mastra/tools/drivers.ts`
- [ ] `lib/mastra/tools/customers.ts`
- [ ] `lib/mastra/tools/expenses.ts`
- [ ] `lib/mastra/tools/invoices.ts`
- [ ] `lib/mastra/tools/notifications.ts`
- [ ] `lib/mastra/tools/reports.ts`

### 6.3 AI Workflows

Files to create:
- [ ] `lib/mastra/workflows/trip-notification.ts`
- [ ] `lib/mastra/workflows/invoice-reminder.ts`
- [ ] `lib/mastra/workflows/daily-summary.ts`

### 6.4 AI Chat Interface

Files to create:
- [ ] `app/(dashboard)/ai/page.tsx`
- [ ] `components/ai/ai-chat.tsx`
- [ ] `app/api/ai/chat/route.ts`

### Deliverables
- ✅ WhatsApp connection working
- ✅ Trip notifications to drivers
- ✅ Invoice reminders to customers
- ✅ AI chat interface
- ✅ Automated workflows

---

## Phase 7: Advanced Features (Week 13-14)

### 7.1 Edit Request System

Files to create:
- [ ] `app/(dashboard)/edit-requests/page.tsx`
- [ ] `components/edit-requests/edit-request-modal.tsx`
- [ ] `components/edit-requests/edit-request-review.tsx`
- [ ] `app/api/edit-requests/route.ts`
- [ ] `app/api/edit-requests/[id]/approve/route.ts`
- [ ] `app/api/edit-requests/[id]/reject/route.ts`

### 7.2 Employee Management

Files to create:
- [ ] `app/(dashboard)/employees/page.tsx`
- [ ] `app/(dashboard)/employees/new/page.tsx`
- [ ] `app/(dashboard)/employees/[id]/page.tsx`
- [ ] `components/employees/employee-form.tsx`
- [ ] `app/api/employees/route.ts`

### 7.3 Inventory Management

Files to create:
- [ ] `app/(dashboard)/inventory/page.tsx`
- [ ] `app/(dashboard)/inventory/new/page.tsx`
- [ ] `components/inventory/inventory-form.tsx`
- [ ] `components/inventory/allocation-modal.tsx`
- [ ] `app/api/inventory/route.ts`
- [ ] `app/api/inventory/[id]/allocate/route.ts`

### 7.4 User Management

Files to create:
- [ ] `app/(dashboard)/users/page.tsx`
- [ ] `app/(dashboard)/users/new/page.tsx`
- [ ] `components/users/user-form.tsx`
- [ ] `components/users/role-select.tsx`
- [ ] `app/api/users/route.ts`

### Deliverables
- ✅ Staff edit request workflow
- ✅ Admin approval system
- ✅ Employee management
- ✅ Inventory with part allocation
- ✅ User management

---

## Phase 8: Dashboard & Polish (Week 15-16)

### 8.1 Dashboard

Files to create:
- [ ] `app/(dashboard)/dashboard/page.tsx`
- [ ] `components/dashboard/stats-cards.tsx`
- [ ] `components/dashboard/revenue-chart.tsx`
- [ ] `components/dashboard/fleet-status.tsx`
- [ ] `components/dashboard/recent-trips.tsx`
- [ ] `components/dashboard/pending-requests.tsx`
- [ ] `components/dashboard/alerts.tsx`
- [ ] `app/api/dashboard/stats/route.ts`

### 8.2 Settings

Files to create:
- [ ] `app/(dashboard)/settings/page.tsx`
- [ ] `components/settings/organization-form.tsx`
- [ ] `components/settings/expense-categories.tsx`
- [ ] `components/settings/whatsapp-config.tsx`

### 8.3 Global Features

- [ ] Global search implementation
- [ ] Notification bell/dropdown
- [ ] Toast notifications
- [ ] Loading states
- [ ] Error boundaries

### 8.4 Mobile Responsiveness

- [ ] Mobile sidebar (sheet)
- [ ] Responsive tables
- [ ] Touch-friendly interactions

### Deliverables
- ✅ Complete dashboard
- ✅ Organization settings
- ✅ Global search
- ✅ Notifications
- ✅ Mobile responsive

---

## Phase 9: Testing & Deployment (Week 17-18)

### 9.1 Testing

- [ ] Unit tests for utilities
- [ ] API integration tests
- [ ] E2E tests for critical flows
- [ ] Performance testing

### 9.2 Security Audit

- [ ] Authentication flow review
- [ ] Authorization checks
- [ ] SQL injection prevention
- [ ] XSS prevention
- [ ] Rate limiting

### 9.3 Deployment

- [ ] Set up production database
- [ ] Configure environment variables
- [ ] Deploy to Vercel/Railway
- [ ] Set up monitoring
- [ ] Configure backups

### 9.4 Documentation

- [ ] User manual
- [ ] Admin guide
- [ ] API documentation
- [ ] Deployment guide

### Deliverables
- ✅ All tests passing
- ✅ Security audit complete
- ✅ Production deployed
- ✅ Documentation complete

---

## File Structure

```
wd-logistics/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/
│   │   │   ├── fleet/
│   │   │   │   ├── trucks/
│   │   │   │   └── drivers/
│   │   │   ├── operations/
│   │   │   │   ├── trips/
│   │   │   │   └── expenses/
│   │   │   ├── customers/
│   │   │   ├── finance/
│   │   │   │   ├── invoices/
│   │   │   │   └── payments/
│   │   │   ├── inventory/
│   │   │   ├── employees/
│   │   │   ├── edit-requests/
│   │   │   ├── reports/
│   │   │   ├── users/
│   │   │   ├── settings/
│   │   │   ├── ai/
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   ├── trucks/
│   │   │   ├── drivers/
│   │   │   ├── trips/
│   │   │   ├── expenses/
│   │   │   ├── customers/
│   │   │   ├── invoices/
│   │   │   ├── payments/
│   │   │   ├── inventory/
│   │   │   ├── employees/
│   │   │   ├── edit-requests/
│   │   │   ├── reports/
│   │   │   ├── users/
│   │   │   ├── dashboard/
│   │   │   ├── whatsapp/
│   │   │   └── ai/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                    # shadcn components
│   │   ├── layout/
│   │   ├── auth/
│   │   ├── trucks/
│   │   ├── drivers/
│   │   ├── trips/
│   │   ├── expenses/
│   │   ├── customers/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── inventory/
│   │   ├── employees/
│   │   ├── edit-requests/
│   │   ├── reports/
│   │   ├── users/
│   │   ├── settings/
│   │   ├── dashboard/
│   │   └── ai/
│   ├── lib/
│   │   ├── auth.ts
│   │   ├── auth-client.ts
│   │   ├── prisma.ts
│   │   ├── api-helpers.ts
│   │   ├── storage.ts
│   │   ├── utils.ts
│   │   ├── whatsapp/
│   │   ├── mastra/
│   │   │   ├── index.ts
│   │   │   ├── tools/
│   │   │   └── workflows/
│   │   ├── reports/
│   │   │   ├── pdf-generator.tsx
│   │   │   └── csv-generator.ts
│   │   └── validations/
│   ├── hooks/
│   │   ├── use-permissions.ts
│   │   └── ...
│   ├── config/
│   │   ├── navigation.ts
│   │   └── reports.ts
│   └── types/
│       └── index.ts
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── public/
│   ├── images/
│   └── fonts/
├── .env
├── .env.example
├── middleware.ts
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Environment Variables

```env
# Database
DATABASE_URL="postgresql://..."

# better-auth
BETTER_AUTH_SECRET="..."
BETTER_AUTH_URL="http://localhost:3000"

# Next.js
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Storage (S3/R2)
STORAGE_ENDPOINT="..."
STORAGE_ACCESS_KEY="..."
STORAGE_SECRET_KEY="..."
STORAGE_BUCKET="..."

# WhatsApp (optional)
WHATSAPP_ENABLED="true"

# Mastra AI (optional)
OPENAI_API_KEY="..."
```

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^14.0.0",
    "@prisma/client": "^5.0.0",
    "better-auth": "^1.0.0",
    "@better-auth/prisma": "^1.0.0",
    "zod": "^3.22.0",
    "react-hook-form": "^7.48.0",
    "@hookform/resolvers": "^3.3.0",
    "@tanstack/react-table": "^8.10.0",
    "lucide-react": "^0.290.0",
    "@react-pdf/renderer": "^3.1.0",
    "@mastra/core": "^0.1.0",
    "whatsapp-web.js": "^1.23.0",
    "date-fns": "^2.30.0",
    "recharts": "^2.9.0",
    "sonner": "^1.2.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.0.0",
    "tailwind-merge": "^2.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0",
    "@types/node": "^20.0.0",
    "@types/react": "^18.0.0",
    "tailwindcss": "^3.3.0",
    "postcss": "^8.4.0",
    "autoprefixer": "^10.4.0"
  }
}
```

---

## Success Metrics

### Phase Completion Criteria

Each phase is complete when:
1. All features in the phase are functional
2. Role-based access is properly implemented
3. UI is responsive and polished
4. API endpoints are secure
5. No critical bugs

### Final Product Criteria

- [ ] All roles work as specified
- [ ] Reports generate correctly with branding
- [ ] WhatsApp notifications send successfully
- [ ] AI agent can answer questions about business data
- [ ] Performance is acceptable (< 2s page loads)
- [ ] Mobile experience is usable
- [ ] No security vulnerabilities
- [ ] Documentation is complete
