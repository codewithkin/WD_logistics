import { Agent } from "@mastra/core/agent";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { allTools } from "../tools";
import { mastraConfig } from "../lib/mastra";

// Ensure API key is available
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_API_KEY) {
  console.error("❌ OPENAI_API_KEY environment variable is not set");
  console.error("Available env vars:", Object.keys(process.env).filter(k => k.includes('OPENAI')));
  throw new Error("OPENAI_API_KEY environment variable is not set");
}

console.log("✅ OpenAI API key loaded:", OPENAI_API_KEY.substring(0, 20) + "...");

// Create OpenAI provider with explicit API key
const openaiWithKey = createOpenAI({
  apiKey: OPENAI_API_KEY,
});

// Create the logistics agent with all tools
export const logisticsAgent = new Agent({
  name: mastraConfig.name,
  instructions: mastraConfig.instructions,
  model: openaiWithKey("gpt-4o"),
  // @ts-ignore - Tool types are compatible at runtime
  tools: allTools,
});

export default logisticsAgent;
