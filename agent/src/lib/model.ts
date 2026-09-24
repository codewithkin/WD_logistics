/**
 * The model the assistant runs on.
 *
 * OpenRouter rather than OpenAI directly, so the model can be changed with an
 * environment variable instead of a deploy — which matters here because
 * model names move and this bot is answering a business's real questions.
 *
 * The default is Gemini 3.5 Flash. Measured against the checks in
 * scripts/live-assistant-check.ts:
 *
 *   gemini-3.5-flash, medium reasoning   $0.0131/msg   9.7s
 *   gemini-3.5-flash, low reasoning      $0.0105/msg   6.5s   <- this
 *   gemini-3.5-flash-lite, low reasoning $0.0018/msg   5.3s   (the previous default)
 *
 * Lite was the default first, on the argument that this assistant does
 * lookups and one-sentence replies rather than deliberation, and it is six
 * times cheaper. It was moved up a step after real use showed the difference
 * the price was hiding: asked for "a PDF" with a report named one message
 * earlier, lite lost the thread and printed its own working into the chat —
 * "The user asked for a PDF without specifying which report. Since there is
 * no prior context..." — in front of a customer. Flash is roughly $10.50 per
 * thousand messages against lite's $1.79, which on this traffic is a rounding
 * error next to an assistant that reads as confused.
 *
 * Drop back to google/gemini-3.5-flash-lite via ASSISTANT_MODEL if the bill
 * ever matters more than the polish; re-run the checks either way.
 *
 * Note where the money goes: about 5,500 of the ~5,550 tokens in a turn are
 * the prompt, nearly all of it tool definitions sent on every message. The
 * reply itself is tens of tokens. Cutting tool count or description length
 * moves the bill far more than anything about the answer does.
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
 * How hard the model thinks before answering.
 *
 * The Gemini flash models are reasoning models: they emit thinking tokens,
 * those tokens are billed as *output* (the dearest rate), and they are most
 * of the bill and most of the wait on a short reply — a one-word answer
 * measured 7 prompt tokens against 91 completion tokens, 90 of them
 * reasoning.
 *
 * "low" is the default here because of what this assistant is for: someone
 * in a yard asking what a truck cost last month. That is a lookup and a
 * sentence, not a problem to deliberate over. Raise it if the answers start
 * looking careless — the cost and the latency go up together.
 */
export type ReasoningEffort = "low" | "medium" | "high";

export const ASSISTANT_REASONING_EFFORT: ReasoningEffort =
  (process.env.ASSISTANT_REASONING_EFFORT as ReasoningEffort) || "low";

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
  // The provider forwards this as `reasoning_effort`, which OpenRouter
  // accepts for the Gemini flash models (check `supported_parameters` on
  // https://openrouter.ai/api/v1/models before assuming a new model takes it;
  // one that does not simply ignores it).
  return openrouter(ASSISTANT_MODEL, {
    reasoningEffort: ASSISTANT_REASONING_EFFORT,
  });
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
  console.log(
    `🤖 [assistant] model: ${ASSISTANT_MODEL} via ${where} (reasoning: ${ASSISTANT_REASONING_EFFORT})`,
  );
}
