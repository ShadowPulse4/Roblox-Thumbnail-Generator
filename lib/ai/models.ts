import type { AspectRatio, ProviderCapabilitiesDTO, QualityLevel } from "@/types/generation";

/**
 * What each OpenAI GPT Image model accepts, from the official API reference
 * (developers.openai.com, checked 2026-10-13):
 * - gpt-image-2 and the gpt-image-2.5 families accept any WIDTHxHEIGHT where both
 *   sides are divisible by 16 and the ratio is between 1:3 and 3:1.
 * - Older models only accept 1024x1024, 1536x1024 and 1024x1536, so we generate
 *   the nearest size and crop to the requested ratio afterwards.
 * - quality: low | medium | high; the 2.5 families also accept xhigh and max.
 */

export interface SizePlan {
  /** Size sent to the API. */
  request: { width: number; height: number };
  /** Final size after centre-crop. Equal to `request` when no crop is needed. */
  output: { width: number; height: number };
}

const FLEXIBLE_SIZES: Record<AspectRatio, SizePlan> = {
  // 1080 is not divisible by 16, so request 1088 and trim 8px to get the
  // standard 1920x1080 thumbnail size.
  "16:9": { request: { width: 1920, height: 1088 }, output: { width: 1920, height: 1080 } },
  "1:1": { request: { width: 1024, height: 1024 }, output: { width: 1024, height: 1024 } },
  "4:3": { request: { width: 1536, height: 1152 }, output: { width: 1536, height: 1152 } },
  "9:16": { request: { width: 1088, height: 1920 }, output: { width: 1080, height: 1920 } },
};

const FIXED_SIZES: Record<AspectRatio, SizePlan> = {
  "16:9": { request: { width: 1536, height: 1024 }, output: { width: 1536, height: 864 } },
  "1:1": { request: { width: 1024, height: 1024 }, output: { width: 1024, height: 1024 } },
  "4:3": { request: { width: 1536, height: 1024 }, output: { width: 1365, height: 1024 } },
  "9:16": { request: { width: 1024, height: 1536 }, output: { width: 864, height: 1536 } },
};

export interface OpenAIModelInfo {
  flexibleSizes: boolean;
  quality: Partial<Record<QualityLevel, string>>;
  /** input_fidelity is only accepted by some models for edits. */
  supportsInputFidelity: boolean;
}

export function getOpenAIModelInfo(model: string): OpenAIModelInfo {
  const m = model.toLowerCase();
  const is25 = m.startsWith("gpt-image-2.5");
  const is2 = m.startsWith("gpt-image-2");
  if (is25) {
    return {
      flexibleSizes: true,
      quality: { standard: "medium", high: "high", ultra: "xhigh" },
      supportsInputFidelity: false,
    };
  }
  if (is2) {
    return {
      flexibleSizes: true,
      quality: { standard: "medium", high: "high" },
      supportsInputFidelity: false,
    };
  }
  return {
    flexibleSizes: false,
    quality: { standard: "medium", high: "high" },
    supportsInputFidelity: m === "gpt-image-1" || m.startsWith("gpt-image-1.5"),
  };
}

export function getSizePlan(model: string, ratio: AspectRatio): SizePlan {
  return getOpenAIModelInfo(model).flexibleSizes ? FLEXIBLE_SIZES[ratio] : FIXED_SIZES[ratio];
}

export function openAICapabilities(model: string, maxImages: number): ProviderCapabilitiesDTO {
  const info = getOpenAIModelInfo(model);
  const aspectRatios: ProviderCapabilitiesDTO["aspectRatios"] = {};
  for (const ratio of ["16:9", "1:1", "4:3", "9:16"] as const) {
    const plan = getSizePlan(model, ratio);
    aspectRatios[ratio] = {
      width: plan.output.width,
      height: plan.output.height,
      cropped: plan.output.width !== plan.request.width || plan.output.height !== plan.request.height,
    };
  }
  return {
    edit: true,
    // The old /images/variations endpoint is retired; variations are made via the
    // edits endpoint with the source image as reference.
    variations: true,
    quality: info.quality,
    maxImagesPerRequest: Math.min(maxImages, 10),
    aspectRatios,
    negativePrompt: false,
  };
}
