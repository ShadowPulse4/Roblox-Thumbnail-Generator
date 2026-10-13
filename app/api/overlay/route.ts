import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { getGenerationForUser, insertImage } from "@/lib/database/repo";
import { errorResponse, parseJson } from "@/lib/http";
import { loadSourceImage } from "@/lib/jobs/source-image";
import { renderOverlay } from "@/lib/overlay/render";
import { checkRateLimit } from "@/lib/rate-limit";
import { saveImageFile } from "@/lib/storage/local";
import { overlayRequestSchema } from "@/lib/validation/schemas";

/**
 * Adds (or replaces) a text overlay. Always renders onto the original image
 * without text and saves the result as a new image; nothing is overwritten.
 * Runs locally with sharp, so it costs no API credit.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const body = await parseJson(request, overlayRequestSchema);
    checkRateLimit(`overlay:${user.id}`, getConfig().rateLimitPerMinute * 5, 60_000);
    const source = await loadSourceImage(user.id, body.imageId, { preferOriginal: true });
    const rendered = await renderOverlay(source.data, body.overlay);
    const id = randomUUID();
    const storagePath = await saveImageFile(user.id, id, rendered.data, "png");
    insertImage({
      id,
      generationId: source.image.generationId,
      userId: user.id,
      storagePath,
      width: rendered.width,
      height: rendered.height,
      format: "png",
      bytes: rendered.data.length,
      parentImageId: source.image.id,
      overlay: body.overlay,
    });
    const generation = getGenerationForUser(user.id, source.image.generationId);
    const image = generation?.images.find((i) => i.id === id) ?? null;
    return NextResponse.json({ image, generation }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
