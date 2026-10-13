import { after, NextResponse } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { buildImagePrompt } from "@/lib/ai/prompt-builder";
import { assertAiAllowed, requireUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { errorResponse, parseJson } from "@/lib/http";
import { startGeneration } from "@/lib/jobs/generation";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanupStaleGenerations, getImageProvider } from "@/lib/services";
import { assertCanGenerate } from "@/lib/usage/limits";
import { generateRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    assertAiAllowed();
    const user = await requireUser();
    const cfg = getConfig();
    const body = await parseJson(request, generateRequestSchema(cfg.maxPromptLength));
    checkRateLimit(`image:${user.id}`, cfg.rateLimitPerMinute, 60_000);
    cleanupStaleGenerations();

    const provider = getImageProvider();
    const caps = provider.getSupportedCapabilities();
    if (body.count > caps.maxImagesPerRequest) {
      throw new AppError("bad_request", `Dit model maakt maximaal ${caps.maxImagesPerRequest} afbeeldingen per keer.`);
    }
    if (!caps.quality[body.quality]) {
      throw new AppError("unsupported", "Deze kwaliteit wordt niet ondersteund door het ingestelde model.");
    }
    assertCanGenerate(user, body.count, cfg);

    const overlay = body.overlay ?? null;
    const usedEnhance = Boolean(body.originalPrompt && body.originalPrompt.trim() !== body.prompt);
    const generationId = startGeneration(
      {
        userId: user.id,
        kind: "generate",
        provider,
        prompt: usedEnhance ? body.originalPrompt!.trim() : body.prompt,
        enhancedPrompt: usedEnhance ? body.prompt : null,
        finalPrompt: buildImagePrompt({
          description: body.prompt,
          style: body.style,
          aspectRatio: body.aspectRatio,
          overlay: overlay ? { text: overlay.text, position: overlay.position } : null,
        }),
        aspectRatio: body.aspectRatio,
        style: body.style,
        quality: body.quality,
        count: body.count,
        overlay,
        source: null,
      },
      (fn) => after(fn),
    );
    return NextResponse.json({ generationId }, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
