import { after, NextResponse } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { buildEditPrompt } from "@/lib/ai/prompt-builder";
import { assertAiAllowed, requireUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { errorResponse, parseJson } from "@/lib/http";
import { startGeneration } from "@/lib/jobs/generation";
import { loadSourceImage } from "@/lib/jobs/source-image";
import { checkRateLimit } from "@/lib/rate-limit";
import { cleanupStaleGenerations, getImageProvider } from "@/lib/services";
import { assertCanGenerate } from "@/lib/usage/limits";
import { editRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    assertAiAllowed();
    const user = await requireUser();
    const cfg = getConfig();
    const body = await parseJson(request, editRequestSchema);
    checkRateLimit(`image:${user.id}`, cfg.rateLimitPerMinute, 60_000);
    cleanupStaleGenerations();

    const provider = getImageProvider();
    if (!provider.editImage || !provider.getSupportedCapabilities().edit) {
      throw new AppError("unsupported", `${provider.displayName} (${provider.model}) kan geen bestaande afbeeldingen bewerken.`);
    }
    assertCanGenerate(user, 1, cfg);
    const source = await loadSourceImage(user.id, body.imageId);

    const generationId = startGeneration(
      {
        userId: user.id,
        kind: "edit",
        provider,
        prompt: body.instruction,
        enhancedPrompt: null,
        finalPrompt: buildEditPrompt(body.instruction),
        aspectRatio: source.generation.aspectRatio,
        style: source.generation.visualStyle,
        quality: body.quality,
        count: 1,
        overlay: null,
        source: { imageId: source.image.id, image: { data: source.data, mimeType: "image/png" } },
      },
      (fn) => after(fn),
    );
    return NextResponse.json({ generationId }, { status: 202 });
  } catch (err) {
    return errorResponse(err);
  }
}
