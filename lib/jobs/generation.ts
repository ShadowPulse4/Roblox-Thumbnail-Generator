import "server-only";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import type { AspectRatio, GenerationKind, QualityLevel, TextOverlay, VisualStyle } from "@/types/generation";
import {
  isProviderJob,
  type ImageGenerationProvider,
  type ProviderImage,
  type ProviderJob,
  type ProviderResult,
} from "@/types/provider";
import { AppError, isAppError } from "@/lib/ai/errors";
import { getSizePlan } from "@/lib/ai/models";
import { getConfig } from "@/lib/config";
import { createGeneration, insertImage, setGenerationStatus } from "@/lib/database/repo";
import { renderOverlay } from "@/lib/overlay/render";
import { saveImageFile } from "@/lib/storage/local";
import { recordUsage, type UsageOperation } from "@/lib/usage/records";

export interface GenerationTask {
  userId: string;
  kind: GenerationKind;
  provider: ImageGenerationProvider;
  /** User-visible prompt (original idea or edit instruction). */
  prompt: string;
  enhancedPrompt: string | null;
  /** Full prompt that is sent to the image model. */
  finalPrompt: string;
  aspectRatio: AspectRatio;
  style: VisualStyle;
  quality: QualityLevel;
  count: number;
  overlay: TextOverlay | null;
  /** For edits and variations. */
  source: { imageId: string; image: ProviderImage } | null;
}

const OPERATION: Record<GenerationKind, UsageOperation> = {
  generate: "image.generate",
  edit: "image.edit",
  variation: "image.variation",
};

const POLL_INTERVAL_MS = 3000;

/** Creates the generation row and returns its id; the work itself runs in `schedule`. */
export function startGeneration(task: GenerationTask, schedule: (fn: () => Promise<void>) => void): string {
  const capabilities = task.provider.getSupportedCapabilities();
  const providerQuality = capabilities.quality[task.quality];
  if (!providerQuality) {
    throw new AppError("unsupported", "Deze kwaliteit wordt niet ondersteund door het ingestelde model.");
  }
  const id = createGeneration({
    userId: task.userId,
    kind: task.kind,
    parentImageId: task.source?.imageId ?? null,
    prompt: task.prompt,
    enhancedPrompt: task.enhancedPrompt,
    finalPrompt: task.finalPrompt,
    aspectRatio: task.aspectRatio,
    visualStyle: task.style,
    quality: task.quality,
    providerQuality,
    imageCount: task.count,
    imageProvider: task.provider.id,
    imageModel: task.provider.model,
    overlay: task.overlay,
  });
  schedule(() => runGeneration(id, task));
  return id;
}

async function callProvider(task: GenerationTask, signal: AbortSignal): Promise<ProviderResult | ProviderJob> {
  const { provider } = task;
  if (task.kind === "generate") {
    return provider.generateImage({
      prompt: task.finalPrompt,
      aspectRatio: task.aspectRatio,
      quality: task.quality,
      count: task.count,
      signal,
    });
  }
  if (!task.source) throw new AppError("bad_request", "Geen bronafbeelding.");
  const input = {
    prompt: task.finalPrompt,
    images: [task.source.image],
    aspectRatio: task.aspectRatio,
    quality: task.quality,
    count: task.count,
    signal,
  };
  if (task.kind === "edit") {
    if (!provider.editImage) throw new AppError("unsupported", "Dit model kan geen afbeeldingen bewerken.");
    return provider.editImage(input);
  }
  if (!provider.generateVariations) throw new AppError("unsupported", "Dit model kan geen variaties maken.");
  return provider.generateVariations(input);
}

async function waitForJob(provider: ImageGenerationProvider, job: ProviderJob, signal: AbortSignal): Promise<ProviderResult> {
  if (!provider.getGenerationStatus) {
    throw new AppError("provider_invalid_response", "De provider gaf een taak-id terug maar kan de status niet opvragen.");
  }
  while (!signal.aborted) {
    const status = await provider.getGenerationStatus(job.jobId);
    if (status.state === "succeeded") return status.result;
    if (status.state === "failed") throw new AppError("provider_unavailable", "De provider meldt dat de generatie is mislukt.");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new AppError("provider_timeout", "De generatie duurde te lang en is afgebroken.");
}

/** Crops/normalises a provider image to the exact output size for the aspect ratio. */
export async function normaliseImage(data: Buffer, model: string, ratio: AspectRatio) {
  const plan = getSizePlan(model, ratio);
  const img = sharp(data, { failOn: "error" });
  const meta = await img.metadata();
  if (!meta.width || !meta.height) {
    throw new AppError("provider_invalid_response", "De provider gaf een onleesbare afbeelding terug.");
  }
  const { width, height } = plan.output;
  const out =
    meta.width === width && meta.height === height
      ? await img.png().toBuffer()
      : await img.resize(width, height, { fit: "cover", position: "centre" }).png().toBuffer();
  return { data: out, width, height };
}

export async function runGeneration(generationId: string, task: GenerationTask): Promise<void> {
  const cfg = getConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.imageTimeoutMs);
  setGenerationStatus(generationId, "running");
  let usageRecorded = false;
  try {
    let result = await callProvider(task, controller.signal);
    if (isProviderJob(result)) result = await waitForJob(task.provider, result, controller.signal);

    // Record usage as soon as the provider has produced images: they are billed
    // even if saving fails afterwards.
    recordUsage({
      userId: task.userId,
      generationId,
      provider: task.provider.id,
      model: result.model,
      operation: OPERATION[task.kind],
      imageCount: result.images.length,
      usage: result.usage,
      metadata: { aspectRatio: task.aspectRatio, quality: result.providerQuality },
    });
    usageRecorded = true;

    for (const img of result.images) {
      const normalised = await normaliseImage(img.data, task.provider.model, task.aspectRatio);
      const imageId = randomUUID();
      const storagePath = await saveImageFile(task.userId, imageId, normalised.data, "png");
      insertImage({
        id: imageId,
        generationId,
        userId: task.userId,
        storagePath,
        width: normalised.width,
        height: normalised.height,
        format: "png",
        bytes: normalised.data.length,
        parentImageId: task.source?.imageId ?? null,
        overlay: null,
      });

      if (task.overlay) {
        const withText = await renderOverlay(normalised.data, task.overlay);
        const overlayId = randomUUID();
        const overlayPath = await saveImageFile(task.userId, overlayId, withText.data, "png");
        insertImage({
          id: overlayId,
          generationId,
          userId: task.userId,
          storagePath: overlayPath,
          width: withText.width,
          height: withText.height,
          format: "png",
          bytes: withText.data.length,
          parentImageId: imageId,
          overlay: task.overlay,
        });
      }
    }
    setGenerationStatus(generationId, "succeeded");
  } catch (err) {
    const appErr = isAppError(err)
      ? err
      : new AppError("internal", "Het verwerken van de afbeelding is mislukt.", { cause: err });
    if (!isAppError(err)) console.error("[generation] failed", generationId, err);
    setGenerationStatus(generationId, "failed", {
      code: appErr.code,
      message: usageRecorded ? `${appErr.message} De afbeelding is wel gegenereerd en mogelijk gefactureerd.` : appErr.message,
    });
  } finally {
    clearTimeout(timer);
  }
}
