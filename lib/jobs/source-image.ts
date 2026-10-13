import "server-only";
import { AppError } from "@/lib/ai/errors";
import { getGenerationForUser, getImageForUser } from "@/lib/database/repo";
import { readImageFile } from "@/lib/storage/local";

/**
 * Loads an image the user owns, plus its generation, for edits and variations.
 * With `preferOriginal`, a version with a text overlay is swapped for the
 * image underneath it, so the model does not copy the overlay text.
 */
export async function loadSourceImage(userId: string, imageId: string, opts?: { preferOriginal?: boolean }) {
  let image = getImageForUser(userId, imageId);
  if (!image) throw new AppError("not_found", "Deze afbeelding bestaat niet (meer).");
  if (opts?.preferOriginal && image.hasOverlay && image.parentImageId) {
    image = getImageForUser(userId, image.parentImageId) ?? image;
  }
  const generation = getGenerationForUser(userId, image.generationId);
  if (!generation) throw new AppError("not_found", "Deze afbeelding bestaat niet (meer).");
  let data: Buffer;
  try {
    data = await readImageFile(image.storagePath);
  } catch {
    throw new AppError("not_found", "Het bestand van deze afbeelding ontbreekt.");
  }
  return { image, generation, data };
}
