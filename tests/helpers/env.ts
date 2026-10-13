import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { closeDb } from "@/lib/database/db";
import { resetRateLimits } from "@/lib/rate-limit";
import type { ImageGenerationProvider, ProviderResult } from "@/types/provider";
import { openAICapabilities } from "@/lib/ai/models";

const BASE_ENV = { ...process.env };

/** Fresh temp data dir + clean env for every test. */
export function setupTestEnv(extra: Record<string, string> = {}) {
  closeDb();
  resetRateLimits();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nugget-test-"));
  for (const k of Object.keys(process.env)) if (!(k in BASE_ENV)) delete process.env[k];
  Object.assign(process.env, {
    DATA_DIR: dir,
    AUTH_MODE: "none",
    OPENAI_API_KEY: "",
    ANTHROPIC_API_KEY: "",
    IMAGE_PROVIDER: "openai",
    IMAGE_MODEL: "gpt-image-2",
    DAILY_SPEND_LIMIT_USD: "5",
    MONTHLY_SPEND_LIMIT_USD: "30",
    DAILY_IMAGE_LIMIT_PER_USER: "20",
    ...extra,
  });
  return dir;
}

export async function makePng(width: number, height: number, color = "#7c5cff"): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } }).png().toBuffer();
}

/** A provider double that returns real PNG bytes, used only in tests. */
export function fakeProvider(opts: {
  model?: string;
  result?: (count: number) => Promise<ProviderResult>;
  fail?: Error;
}): ImageGenerationProvider & { calls: { method: string; prompt: string; count: number }[] } {
  const model = opts.model ?? "gpt-image-2";
  const calls: { method: string; prompt: string; count: number }[] = [];
  const run = async (method: string, prompt: string, count: number): Promise<ProviderResult> => {
    calls.push({ method, prompt, count });
    if (opts.fail) throw opts.fail;
    if (opts.result) return opts.result(count);
    const images = await Promise.all(
      Array.from({ length: count }, async () => ({ data: await makePng(1920, 1088), mimeType: "image/png" })),
    );
    return { images, usage: { inputTextTokens: 100, outputImageTokens: 4000 }, providerQuality: "medium", model };
  };
  return {
    id: "openai",
    displayName: "Test provider",
    model,
    calls,
    getSupportedCapabilities: () => openAICapabilities(model, 4),
    generateImage: (i) => run("generate", i.prompt, i.count),
    editImage: (i) => run("edit", i.prompt, i.count),
    generateVariations: (i) => run("variation", i.prompt, i.count),
  };
}
