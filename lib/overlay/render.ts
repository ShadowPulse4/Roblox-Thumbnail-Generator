import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { parse, type Font } from "opentype.js";
import sharp from "sharp";
import type { OverlayFont, TextOverlay } from "@/types/generation";
import { AppError } from "@/lib/ai/errors";
import { buildOverlaySvg, OVERLAY_FONT_FILES, unsupportedCharacters } from "./layout";

const fontCache = new Map<OverlayFont, Font>();

async function loadFont(font: OverlayFont): Promise<Font> {
  const cached = fontCache.get(font);
  if (cached) return cached;
  const file = path.join(process.cwd(), "public", "fonts", OVERLAY_FONT_FILES[font]);
  const buf = await fs.readFile(file);
  const parsed = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  fontCache.set(font, parsed);
  return parsed;
}

/** Draws the overlay on top of the image and returns a new PNG. The source is not modified. */
export async function renderOverlay(source: Buffer, overlay: TextOverlay): Promise<{ data: Buffer; width: number; height: number }> {
  const font = await loadFont(overlay.font);
  const missing = unsupportedCharacters(font, overlay.text);
  if (missing.length > 0) {
    throw new AppError(
      "bad_request",
      `Het lettertype kan deze tekens niet tekenen: ${missing.join(" ")}. Pas de tekst aan.`,
    );
  }
  const meta = await sharp(source).metadata();
  if (!meta.width || !meta.height) {
    throw new AppError("bad_request", "Kon de afmetingen van de afbeelding niet lezen.");
  }
  const { svg } = buildOverlaySvg(font, overlay, meta.width, meta.height);
  const data = await sharp(source)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .png()
    .toBuffer();
  return { data, width: meta.width, height: meta.height };
}
