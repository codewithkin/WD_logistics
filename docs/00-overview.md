# WD Logistics - System Overview

## Project Summary

WD Logistics is a comprehensive logistics management system designed for a trucking company. The system provides end-to-end management of fleet operations, expenses, customer relationships, and business intelligence.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Next.js 14+ (App Router) |
| UI Components | shadcn/ui + Tailwind CSS |
| Authentication | better-auth with Organizations |
| Database | PostgreSQL with Prisma ORM |
| AI Agent | Mastra.ai (local MCP server) |
| Notifications | wweb-js (WhatsApp) |
| Report Generation | PDF (react-pdf) + CSV export |

## Core Features

### 1. Fleet Management
- Truck database with full vehicle details
- Driver database with employment history
- Trip management with mileage tracking
- Maintenance and service records

### 2. Financial Management
- Expense tracking with categories
- Invoice generation and management
- Profit per unit calculations
- Revenue tracking

### 3. Customer Management
- Customer database
- Invoice vs payment tracking
- Statement generation
- Payment reminders

### 4. Reporting System
- Daily, weekly, monthly reports
- Profit per unit analysis
- Expense breakdowns (e.g., tires, tolls)
- PDF/CSV export with WD Logistics branding

### 5. Inventory System (Expandable)
- Parts storeroom management
- Allocation to specific trucks
- Workshop team support

### 6. AI Agent
- WhatsApp notification system
- Business data access
- Driver notifications for new loads

## User Roles

| Role | Access Level |
|------|--------------|
| Admin | Full system access, user management, approvals |
| Supervisor | Everything except reports, cannot edit other users |
| Staff | Limited access, edits require admin approval |

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WD Logistics Platform                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │   Next.js   │  │  Mastra.ai  │  │     wweb-js         │ │
│  │   Web App   │  │  AI Agent   │  │  WhatsApp Bot       │ │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘ │
│         │                │                     │            │
│         └────────────────┼─────────────────────┘            │
│                          │                                  │
│                    ┌─────┴─────┐                           │
│                    │   API     │                           │
│                    │  Routes   │                           │
│                    └─────┬─────┘                           │
│                          │                                  │
│         ┌────────────────┼────────────────┐                │
│         │                │                │                │
│   ┌─────┴─────┐   ┌─────┴─────┐   ┌─────┴─────┐          │
│   │better-auth│   │  Prisma   │   │  Report   │          │
│   │   Org     │   │   ORM     │   │  Engine   │          │
│   └───────────┘   └─────┬─────┘   └───────────┘          │
│                         │                                  │
│                   ┌─────┴─────┐                           │
│                   │PostgreSQL │                           │
│                   │  Database │                           │
│                   └───────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

## Document Index

1. [Database Schema](./01-database-schema.md)
2. [Authentication & Roles](./02-authentication-roles.md)
3. [API Structure](./03-api-structure.md)
4. [UI/UX & Navigation](./04-ui-navigation.md)
5. [Reporting System](./05-reporting-system.md)
6. [AI Agent Integration](./06-ai-agent.md)
7. [Feature Specifications](./07-feature-specs.md)
8. [Implementation Roadmap](./08-implementation-roadmap.md)
