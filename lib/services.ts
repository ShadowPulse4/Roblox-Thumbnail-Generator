import "server-only";
import type { AppStatus } from "@/types/generation";
import type { ImageGenerationProvider } from "@/types/provider";
import { AppError } from "@/lib/ai/errors";
import { createPromptEnhancer, type PromptEnhancer } from "@/lib/ai/enhancer";
import { selectImageProvider } from "@/lib/ai/providers";
import { brand } from "@/lib/brand";
import { getConfig } from "@/lib/config";
import { countImagesSince, failStaleGenerations, type UserRecord } from "@/lib/database/repo";
import { toPublicUser } from "@/lib/auth/session";
import { dailyImageLimitFor } from "@/lib/usage/limits";
import { startOfToday } from "@/lib/usage/records";

export function getImageProvider(): ImageGenerationProvider {
  const selection = selectImageProvider(getConfig());
  if (!selection.ok) throw new AppError("not_configured", selection.message);
  return selection.provider;
}

export function getPromptEnhancer(): PromptEnhancer {
  const cfg = getConfig();
  if (!cfg.anthropicApiKey) {
    throw new AppError(
      "not_configured",
      "Prompt verbeteren gebruikt Claude via de Anthropic API. Voeg ANTHROPIC_API_KEY toe aan .env.local en herstart de app.",
    );
  }
  return createPromptEnhancer({ apiKey: cfg.anthropicApiKey, model: cfg.anthropicModel, timeoutMs: cfg.textTimeoutMs });
}

/** Marks generations as failed when they can no longer finish (e.g. after a restart). */
export function cleanupStaleGenerations() {
  failStaleGenerations(getConfig().imageTimeoutMs + 60_000);
}

export function buildAppStatus(user: UserRecord | null): AppStatus {
  const cfg = getConfig();
  const selection = selectImageProvider(cfg);
  return {
    appName: brand.name,
    mode: cfg.authMode === "none" ? "local-open" : "accounts",
    isProduction: cfg.isProduction,
    openAccessBlocked: cfg.authMode === "none" && cfg.isProduction && !cfg.allowOpenAccess,
    user: user ? toPublicUser(user) : null,
    image: {
      configured: selection.ok,
      provider: selection.ok ? selection.provider.displayName : cfg.imageProvider,
      model: cfg.imageModel,
      capabilities: selection.ok ? selection.provider.getSupportedCapabilities() : null,
    },
    text: {
      configured: Boolean(cfg.anthropicApiKey),
      provider: "anthropic",
      model: cfg.anthropicModel,
    },
    limits: {
      maxPromptLength: cfg.maxPromptLength,
      maxImagesPerRequest: cfg.maxImagesPerRequest,
      dailyImageLimit: user ? dailyImageLimitFor(user, cfg) : null,
      imagesToday: user ? countImagesSince(user.id, startOfToday().toISOString()) : 0,
    },
  };
}
