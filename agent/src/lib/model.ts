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
 * ⚠️ If the default id is ever wrong (OpenRouter renames models from time to
 * time), set ASSISTANT_MODEL and no code change is needed. The startup log
 * prints which id is in use, and a bad id fails on the first message with the
 * provider's own error rather than silently.
 */

import { createOpenAI } from "@ai-sdk/openai";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

/** Override with ASSISTANT_MODEL to pin a different model. */
export const ASSISTANT_MODEL =
  process.env.ASSISTANT_MODEL || "google/gemini-3-flash";

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
  baseURL: "https://openrouter.ai/api/v1",
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
  console.log(`🤖 [assistant] model: ${ASSISTANT_MODEL} via OpenRouter`);
}
