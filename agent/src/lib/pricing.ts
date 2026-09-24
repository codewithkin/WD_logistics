/**
 * What a model turn costs, so the assistant can report its own spend.
 *
 * OpenRouter returns token counts on every response but not a price, and the
 * price is what anyone actually asks about. These are dollars per million
 * tokens, taken from OpenRouter's catalogue; an unknown model yields null
 * rather than a guess, because a wrong cost is worse than no cost.
 *
 * Worth knowing when reading the numbers: the Gemini "flash" models used here
 * are reasoning models. Their thinking is billed as output, and on a short
 * reply the thinking is most of the bill — a one-word answer measured 7
 * prompt tokens against 91 completion tokens, 90 of which were reasoning.
 */

export interface ModelPrice {
  /** USD per million prompt tokens. */
  input: number;
  /** USD per million completion tokens, reasoning included. */
  output: number;
}

export const MODEL_PRICES: Record<string, ModelPrice> = {
  "google/gemini-3.5-flash": { input: 1.5, output: 9.0 },
  "google/gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "google/gemini-3-flash-preview": { input: 0.5, output: 3.0 },
  "google/gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "google/gemini-2.5-flash-lite": { input: 0.1, output: 0.4 },
};

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens?: number;
}

/** Cost of one turn in USD, or null when the model's price isn't known here. */
export function costOf(model: string, usage: TokenUsage): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;

  const dollars =
    (usage.promptTokens / 1_000_000) * price.input +
    (usage.completionTokens / 1_000_000) * price.output;

  // Six decimals: a single message costs fractions of a cent, and rounding to
  // four would report most of them as zero.
  return Math.round(dollars * 1_000_000) / 1_000_000;
}

/** "$0.0042" — small amounts shouldn't collapse to "$0.00". */
export function formatCost(dollars: number | null): string {
  if (dollars === null) return "unknown";
  if (dollars >= 0.01) return `$${dollars.toFixed(2)}`;
  return `$${dollars.toFixed(4)}`;
}
