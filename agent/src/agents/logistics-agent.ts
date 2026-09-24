import { Agent } from "@mastra/core/agent";
import { allTools } from "../tools";
import { mastraConfig } from "../lib/mastra";
import { assistantModel, modelConfigurationProblem } from "../lib/model";

/**
 * The agent behind the web chat widget and the workflow summaries.
 *
 * It used to build its own OpenAI client from `OPENAI_API_KEY` and **throw at
 * module load** if that variable was missing. Since `index.ts` imports this
 * file, a missing key took the whole service down before it could serve a
 * single request — which is exactly what happened on deploy: the container
 * crash-looped, the healthcheck never passed, and Coolify rolled back.
 *
 * Two changes. It now shares the assistant's model — one provider, one key
 * (`OPENROUTER_API_KEY`), rather than a second subscription for a second
 * agent. And it is built lazily: a missing key is reported when somebody
 * actually uses the chat, not at import, so the rest of the service starts
 * and works.
 */

let cached: Agent | null = null;

export function getLogisticsAgent(): Agent {
  const problem = modelConfigurationProblem();
  if (problem) {
    // Thrown from a call rather than at import, so it reaches the caller as a
    // failed request instead of killing the process.
    throw new Error(problem);
  }

  if (!cached) {
    cached = new Agent({
      name: mastraConfig.name,
      instructions: mastraConfig.instructions,
      model: assistantModel(),
      // Tool types are compatible at runtime; Mastra's generics are stricter
      // than the tools it accepts.
      tools: allTools as never,
    });
  }

  return cached;
}
