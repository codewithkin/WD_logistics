This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Period Selector

The application includes a universal period selector for filtering data across all pages that display time-based information (dashboard, reports, expenses, trips, invoices, payments, driver/truck details, etc.).

### Period Format

The period selector supports both preset options and custom period formats.

#### Preset Options

| Value | Label | Description |
|-------|-------|-------------|
| `1d` | Last 24 Hours | Data from the last 24 hours |
| `7d` | Last 7 Days | Data from the last 7 days |
| `1w` | Last Week | Same as 7 days |
| `1m` | Last Month | Data from the last month |
| `3m` | Last 3 Months | Data from the last 3 months |
| `6m` | Last 6 Months | Data from the last 6 months |
| `1y` | Last Year | Data from the last year |
| `ytd` | Year to Date | Data from January 1st of the current year |
| `all` | All Time | All historical data |

#### Custom Period Format

You can specify custom periods using the format: `<number><unit>`

**Units:**
- `d` - Days (e.g., `14d` for last 14 days)
- `w` - Weeks (e.g., `2w` for last 2 weeks)
- `m` - Months (e.g., `6m` for last 6 months)
- `y` - Years (e.g., `2y` for last 2 years)

**Examples:**
- `30d` - Last 30 days
- `4w` - Last 4 weeks
- `6m` - Last 6 months
- `2y` - Last 2 years
- `5y` - Last 5 years

#### URL Parameters

The period can be set via URL query parameters:

1. **Using preset/custom period:**
   ```
   ?period=1m
   ?period=6m
   ?period=2y
   ?period=ytd
   ```

2. **Using explicit date range:**
   ```
   ?from=2025-01-01T00:00:00.000Z&to=2025-12-31T23:59:59.999Z
   ```

### Usage Examples

- Dashboard with last 3 months data: `/dashboard?period=3m`
- Reports for last year: `/reports?period=1y`
- Expenses for last 2 years: `/finance/expenses?period=2y`
- Trips year to date: `/operations/trips?period=ytd`
- Driver performance for specific dates: `/fleet/drivers/[id]?from=2025-01-01&to=2025-06-30`

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
