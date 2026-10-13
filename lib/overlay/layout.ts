import type { Font } from "opentype.js";
import type { OverlayFont, OverlayPosition, TextOverlay } from "@/types/generation";

/**
 * Builds the overlay as an SVG made of glyph outlines (not <text>), so the
 * browser preview and the server render (sharp) look exactly the same and do
 * not depend on fonts installed on the machine.
 * Used on both the client and the server, so keep it free of Node APIs.
 */

export const OVERLAY_FONT_FILES: Record<OverlayFont, string> = {
  "luckiest-guy": "luckiest-guy.woff",
  anton: "anton.woff",
};

export const OVERLAY_FONT_LABELS: Record<OverlayFont, string> = {
  "luckiest-guy": "Luckiest Guy",
  anton: "Anton",
};

export const DEFAULT_OVERLAY: Omit<TextOverlay, "text"> = {
  font: "luckiest-guy",
  sizePercent: 14,
  position: "top",
  fillColor: "#FFD23F",
  outlineColor: "#1A1033",
  outlinePercent: 12,
  rotation: -4,
};

const HEX = /^#[0-9a-fA-F]{6}$/;

function anchor(
  position: OverlayPosition,
  width: number,
  height: number,
  boxW: number,
  boxH: number,
  marginX: number,
  marginY: number,
) {
  const left = marginX;
  const centerX = (width - boxW) / 2;
  const right = width - marginX - boxW;
  const top = marginY;
  const middle = (height - boxH) / 2;
  const bottom = height - marginY - boxH;
  switch (position) {
    case "top-left":
      return { x: left, y: top };
    case "top":
      return { x: centerX, y: top };
    case "top-right":
      return { x: right, y: top };
    case "center":
      return { x: centerX, y: middle };
    case "bottom-left":
      return { x: left, y: bottom };
    case "bottom":
      return { x: centerX, y: bottom };
    case "bottom-right":
      return { x: right, y: bottom };
  }
}

export interface OverlayLayout {
  svg: string;
  fontSize: number;
  /** True when the text was shrunk to fit the image width. */
  shrunk: boolean;
}

export function buildOverlaySvg(font: Font, overlay: TextOverlay, width: number, height: number): OverlayLayout {
  const fill = HEX.test(overlay.fillColor) ? overlay.fillColor : "#FFFFFF";
  const stroke = HEX.test(overlay.outlineColor) ? overlay.outlineColor : "#000000";
  const margin = Math.round(Math.min(width, height) * 0.05);

  let fontSize = (height * overlay.sizePercent) / 100;
  let shrunk = false;
  const maxWidth = width - margin * 2;
  // Outline grows the visual width, so leave room for it when fitting.
  const outlineFor = (size: number) => (size * overlay.outlinePercent) / 100;
  const measure = (size: number) => font.getAdvanceWidth(overlay.text, size) + outlineFor(size) * 2;
  if (measure(fontSize) > maxWidth) {
    fontSize = Math.max(8, (fontSize * maxWidth) / measure(fontSize));
    shrunk = true;
  }

  const outline = outlineFor(fontSize);
  const path = font.getPath(overlay.text, 0, 0, fontSize);
  const bb = path.getBoundingBox();
  const glyphW = bb.x2 - bb.x1;
  const glyphH = bb.y2 - bb.y1;
  const shadowOffset = fontSize * 0.07;
  const boxW = glyphW + outline * 2;
  const boxH = glyphH + outline * 2 + shadowOffset;
  const r = Math.max(-15, Math.min(15, overlay.rotation));
  // Rotating around the centre pushes the corners outwards; add that to the margins
  // so tilted text never gets clipped at the image edge.
  const sin = Math.abs(Math.sin((r * Math.PI) / 180));
  const marginX = margin + (boxH / 2) * sin;
  const marginY = margin + (boxW / 2) * sin;
  const pos = anchor(overlay.position, width, height, boxW, boxH, marginX, marginY);

  // Translate so the glyph bounding box (plus outline) lands on the anchor.
  const tx = pos.x + outline - bb.x1;
  const ty = pos.y + outline - bb.y1;
  const cx = pos.x + boxW / 2;
  const cy = pos.y + boxH / 2;
  const d = path.toPathData(2);

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<g transform="rotate(${r.toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})">` +
    `<g transform="translate(${tx.toFixed(1)} ${(ty + shadowOffset).toFixed(1)})">` +
    `<path d="${d}" fill="${stroke}" fill-opacity="0.55" stroke="${stroke}" stroke-opacity="0.55" stroke-width="${(outline * 2).toFixed(1)}" stroke-linejoin="round"/>` +
    `</g>` +
    `<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)})">` +
    (outline > 0
      ? `<path d="${d}" fill="${stroke}" stroke="${stroke}" stroke-width="${(outline * 2).toFixed(1)}" stroke-linejoin="round"/>`
      : "") +
    `<path d="${d}" fill="${fill}"/>` +
    `</g></g></svg>`;

  return { svg, fontSize, shrunk };
}

/** Characters the bundled fonts cannot draw (they only cover Latin). */
export function unsupportedCharacters(font: Font, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    if (ch === " ") continue;
    const glyph = font.charToGlyph(ch);
    if (!glyph || glyph.index === 0) missing.add(ch);
  }
  return [...missing];
}
