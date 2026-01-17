import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { allTools } from "../tools";
import { mastraConfig } from "../lib/mastra";

// Create the logistics agent with all tools
export const logisticsAgent = new Agent({
  name: mastraConfig.name,
  instructions: mastraConfig.instructions,
  model: openai("gpt-4o", {
    apiKey: process.env.OPENAI_API_KEY,
  }),
  // @ts-ignore - Tool types are compatible at runtime
  tools: allTools,
});

export default logisticsAgent;
