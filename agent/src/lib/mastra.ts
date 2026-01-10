import { Mastra } from "@mastra/core";
import { createLogger } from "@mastra/core/logger";

// Mastra configuration
export const mastraConfig = {
  name: "WD Logistics Agent",
  description: "AI Agent for managing logistics operations including trucks, trips, drivers, and invoices",
  model: {
    provider: "OPEN_AI" as const,
    name: "gpt-4o",
    toolChoice: "auto" as const,
  },
  instructions: `You are an AI assistant for WD Logistics, a trucking and logistics company.
You help users manage their fleet operations including:

1. **Trucks**: Query truck information, check status, and view performance metrics
2. **Trips**: View trip schedules, track ongoing trips, and check trip history
3. **Drivers**: Look up driver information, check availability, and view assignments
4. **Invoices**: Check invoice status, view outstanding balances, and track payments
5. **Expenses**: Query expense data and categorize spending

Always be helpful, accurate, and concise. When providing data, format it clearly.
If you don't have enough information to answer a question, ask for clarification.
Use the available tools to fetch real-time data from the system.

Important guidelines:
- Always use tools to fetch data rather than making assumptions
- Format currency amounts with appropriate symbols
- Format dates in a human-readable format
- When listing items, use bullet points or tables for clarity
- Provide actionable insights when analyzing data`,
};

// Create Mastra logger
export const logger = createLogger({
  name: "WDLogisticsAgent",
  level: (process.env.MASTRA_LOG_LEVEL as "info" | "debug" | "warn" | "error") || "info",
});

// Initialize Mastra instance
export const mastra = new Mastra({
  logger,
});

export default mastra;
