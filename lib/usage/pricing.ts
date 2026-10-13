import type { ProviderUsage } from "@/types/provider";

/**
 * Price table used for ESTIMATES only. Neither OpenAI nor Anthropic returns
 * the billed amount per request, so every cost in the app is marked as
 * "geschat" (estimated). Your real charges are in the provider dashboards.
 *
 * Prices are USD per 1 million tokens. Sources, checked 2026-10-13:
 * - OpenAI: https://developers.openai.com/api/docs/pricing (image generation)
 *   The page did not label clearly which tier this table belongs to; verify it
 *   against your own OpenAI usage page and adjust if needed.
 * - Anthropic: https://platform.claude.com/docs/en/about-claude/pricing
 *   (Haiku 5.5 rate for prompts up to 100k tokens, which always applies here).
 *
 * Models that are not listed get a cost of "unknown" instead of a guess.
 */
export interface ModelPrice {
  textInput: number;
  imageInput?: number;
  imageOutput?: number;
  textOutput?: number;
  checkedAt: string;
}

export const PRICES: Record<string, ModelPrice> = {
  "gpt-image-2": { textInput: 2.5, imageInput: 4, imageOutput: 15, checkedAt: "2026-10-13" },
  "gpt-image-2-2026-04-21": { textInput: 2.5, imageInput: 4, imageOutput: 15, checkedAt: "2026-10-13" },
  "gpt-image-2.5-sunburst": { textInput: 5, imageInput: 8, imageOutput: 30, checkedAt: "2026-10-13" },
  "gpt-image-2.5-flare": { textInput: 5, imageInput: 8, imageOutput: 30, checkedAt: "2026-10-13" },
  "claude-haiku-5-5": { textInput: 0.1, textOutput: 0.5, checkedAt: "2026-10-13" },
  "claude-sonnet-5-5": { textInput: 2, textOutput: 10, checkedAt: "2026-10-13" },
};

function priceFor(model: string): ModelPrice | null {
  if (PRICES[model]) return PRICES[model];
  // Dated snapshots (e.g. gpt-image-2.5-flare-2026-09-08) share the base model price.
  const base = Object.keys(PRICES)
    .filter((k) => model.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return base ? PRICES[base] : null;
}

export interface CostEstimate {
  usd: number | null;
  status: "estimated" | "confirmed" | "unknown";
}

export function estimateCost(model: string, usage: ProviderUsage | null): CostEstimate {
  if (usage?.confirmedCostUsd !== undefined) {
    return { usd: usage.confirmedCostUsd, status: "confirmed" };
  }
  const price = priceFor(model);
  if (!price || !usage) return { usd: null, status: "unknown" };
  const perToken = (perMillion: number | undefined, tokens: number | undefined) =>
    perMillion && tokens ? (perMillion * tokens) / 1_000_000 : 0;
  const usd =
    perToken(price.textInput, usage.inputTextTokens) +
    perToken(price.imageInput ?? price.textInput, usage.inputImageTokens) +
    perToken(price.imageOutput, usage.outputImageTokens) +
    perToken(price.textOutput, usage.outputTextTokens);
  return { usd: Math.round(usd * 1_000_000) / 1_000_000, status: "estimated" };
}
