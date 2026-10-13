import { after, NextResponse } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { buildVariationPrompt } from "@/lib/ai/prompt-builder";
import { assertAiAllowed, requireUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { errorResponse, parseJson } from "@/lib/http";
import { startGeneration } from "@/lib/jobs/generation";
import { loadSourceImage } from "@/lib/jobs/source-image";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanupStaleGenerations, getImageProvider } from "@/lib/services";
import { assertCanGenerate } from "@/lib/usage/limits";
import { variationRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    assertAiAllowed();
    const user = await requireUser();
    const cfg = getConfig();
    const body = await parseJson(request, variationRequestSchema);
    checkRateLimit(`image:${user.id}`, cfg.rateLimitPerMinute, 60_000);
    cleanupStaleGenerations();

    const provider = getImageProvider();
    const caps = provider.getSupportedCapabilities();
    if (!provider.generateVariations || !caps.variations) {
      throw new AppError("unsupported", `${provider.displayName} (${provider.model}) kan geen variaties maken.`);
    }
    if (body.count > caps.maxImagesPerRequest) {
      throw new AppError("bad_request", `Dit model maakt maximaal ${caps.maxImagesPerRequest} afbeeldingen per keer.`);
    }
    assertCanGenerate(user, body.count, cfg);
    const source = await loadSourceImage(user.id, body.imageId, { preferOriginal: true });
    const description = source.generation.enhancedPrompt ?? source.generation.prompt;

    const generationId = startGeneration(
      {
        userId: user.id,
        kind: "variation",
        provider,
        prompt: source.generation.prompt,
        enhancedPrompt: source.generation.enhancedPrompt,
        finalPrompt: buildVariationPrompt(description, source.generation.visualStyle),
        aspectRatio: source.generation.aspectRatio,
        style: source.generation.visualStyle,
        quality: body.quality,
        count: body.count,
        // Keep the same title overlay on variations so they stay comparable.
        overlay: source.generation.kind === "generate" ? source.generation.overlay : null,
        source: { imageId: source.image.id, image: { data: source.data, mimeType: "image/png" } },
      },
      (fn) => after(fn),
    );
    return NextResponse.json({ generationId }, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
