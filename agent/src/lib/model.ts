/**
 * The model the assistant runs on.
 *
 * OpenRouter rather than OpenAI directly, so the model can be changed with an
 * environment variable instead of a deploy — which matters here because
 * model names move and this bot is answering a business's real questions.
 *
 * The default is Gemini Flash: it is fast and cheap, which suits a WhatsApp
 * assistant where somebody is waiting on their phone, and it handles tool
 * calling well enough for the dozen-odd tools each caller gets.
 *
 * ⚠️ The default id must be one OpenRouter actually serves. The first default
 * written here, "google/gemini-3-flash", did not exist — the catalogue offers
 * "google/gemini-3-flash-preview" and "google/gemini-3.5-flash" but no plain
 * "gemini-3-flash" — so the assistant would have failed on its first real
 * message. Check against https://openrouter.ai/api/v1/models before changing
 * it. Set ASSISTANT_MODEL to override without a deploy; the startup log
 * prints the id in use, and a bad one fails loudly with the provider's error.
 */

import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

/** Override with ASSISTANT_MODEL to pin a different model. */
export const ASSISTANT_MODEL =
  process.env.ASSISTANT_MODEL || "google/gemini-3.5-flash";

/**
 * Where the model actually lives.
 *
 * OpenRouter by default. It is overridable so the assistant can be pointed at
 * a company gateway, a self-hosted proxy, or — the reason it exists — a stub
 * server during testing, which is the only way to exercise the tool-calling
 * loop without spending real tokens on every run.
 */
export const ASSISTANT_BASE_URL =
  process.env.ASSISTANT_BASE_URL || "https://openrouter.ai/api/v1";

/**
 * Where the key came from, so a missing one is obvious at boot rather than on
 * the first customer message.
 */
export function modelConfigurationProblem(): string | null {
  if (!OPENROUTER_API_KEY) {
    return "OPENROUTER_API_KEY is not set, so the assistant cannot answer anything. Get a key from openrouter.ai and set it.";
  }
  return null;
}

/**
 * OpenRouter speaks the OpenAI API, so the provider already in this project
 * reaches it by pointing at their base URL. That is deliberate rather than
 * lazy: the dedicated @openrouter/ai-sdk-provider is built for AI SDK v5,
 * while the Mastra version here expects v1 models, and mixing them fails to
 * typecheck on `specificationVersion`.
 */
const openrouter = createOpenAI({
  apiKey: OPENROUTER_API_KEY,
  baseURL: ASSISTANT_BASE_URL,
  // Shows up in OpenRouter's dashboard, which is how spend gets attributed
  // when several things share an account.
  headers: {
    "HTTP-Referer": process.env.WEB_APP_URL || "https://wd-logistics.co.zw",
    "X-Title": "WD Logistics Assistant",
  },
});

export function assistantModel() {
  return openrouter(ASSISTANT_MODEL);
}

export function logModelConfiguration(): void {
  const problem = modelConfigurationProblem();
  if (problem) {
    console.warn(`⚠️  [assistant] ${problem}`);
    return;
  }
  const where =
    ASSISTANT_BASE_URL === "https://openrouter.ai/api/v1"
      ? "OpenRouter"
      : ASSISTANT_BASE_URL;
  console.log(`🤖 [assistant] model: ${ASSISTANT_MODEL} via ${where}`);
}
