import "server-only";
import type { ImageGenerationProvider } from "@/types/provider";
import type { AppConfig } from "@/lib/config";
import { createOpenAIImageProvider } from "./openai";

/**
 * Registry of image providers. To add another service, implement
 * ImageGenerationProvider in its own file and add a case here.
 */
export const SUPPORTED_IMAGE_PROVIDERS = ["openai"] as const;

export type ProviderSelection =
  | { ok: true; provider: ImageGenerationProvider }
  | { ok: false; reason: "missing_key" | "unknown_provider"; provider: string; message: string };

export function selectImageProvider(config: AppConfig): ProviderSelection {
  switch (config.imageProvider) {
    case "openai":
      if (!config.openaiApiKey) {
        return {
          ok: false,
          reason: "missing_key",
          provider: "openai",
          message: "Er is nog geen OPENAI_API_KEY ingesteld. Voeg die toe aan .env.local en herstart de app.",
        };
      }
      return {
        ok: true,
        provider: createOpenAIImageProvider({
          apiKey: config.openaiApiKey,
          model: config.imageModel,
          timeoutMs: config.imageTimeoutMs,
          maxImagesPerRequest: config.maxImagesPerRequest,
        }),
      };
    default:
      return {
        ok: false,
        reason: "unknown_provider",
        provider: config.imageProvider,
        message: `IMAGE_PROVIDER="${config.imageProvider}" wordt niet ondersteund. Gebruik een van: ${SUPPORTED_IMAGE_PROVIDERS.join(", ")}.`,
      };
  }
}
