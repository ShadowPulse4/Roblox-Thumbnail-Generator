import type { Font } from "opentype.js";
import type { OverlayArrow, OverlayFont, OverlayPosition, OverlayStyle, TextOverlay } from "@/types/generation";

/**
 * Builds the overlay as an SVG made of glyph outlines (not <text>), so the
 * browser preview and the server render (sharp) look exactly the same and do
 * not depend on fonts installed on the machine.
 * Used on both the client and the server, so keep it free of Node APIs.
 *
 * Three looks, modelled on typical Roblox thumbnails:
 * - title:   chunky 3D letters with a gold gradient, thick dark rim, extrusion and glow ("EPIC BOSSES")
 * - outline: solid letters with a thick rim and drop shadow ("YOU")
 * - label:   text on a dark rounded box ("+1,000,000 STRENGTH")
 * Optionally a red callout arrow under the text points at the subject.
 */

export const OVERLAY_FONT_FILES: Record<OverlayFont, string> = {
  "luckiest-guy": "luckiest-guy.woff",
  anton: "anton.woff",
};

export const OVERLAY_FONT_LABELS: Record<OverlayFont, string> = {
  "luckiest-guy": "Luckiest Guy",
  anton: "Anton",
};

export const OVERLAY_STYLE_LABELS: Record<OverlayStyle, string> = {
  title: "3D-titel",
  outline: "Met rand",
  label: "Label",
};

export const MAX_OVERLAY_LINES = 3;

export const DEFAULT_OVERLAY: Omit<TextOverlay, "text"> = {
  style: "title",
  font: "luckiest-guy",
  sizePercent: 16,
  position: "top",
  fillColor: "#FFE14D",
  fillColor2: "#FF6A00",
  outlineColor: "#1A0E05",
  outlinePercent: 14,
  rotation: -3,
  arrow: "none",
};

/** Ready-made looks that match common thumbnail text. */
export const OVERLAY_PRESETS: { id: string; label: string; overlay: Omit<TextOverlay, "text">; text?: string }[] = [
  { id: "gold", label: "Gouden titel", overlay: DEFAULT_OVERLAY },
  {
    id: "fire",
    label: "Vuur-titel",
    overlay: { ...DEFAULT_OVERLAY, fillColor: "#FFD23F", fillColor2: "#E8200C", outlineColor: "#140404" },
  },
  {
    id: "you",
    label: "YOU met pijl",
    text: "YOU",
    overlay: {
      ...DEFAULT_OVERLAY,
      style: "outline",
      sizePercent: 14,
      position: "top-right",
      fillColor: "#FFFFFF",
      outlineColor: "#000000",
      outlinePercent: 14,
      rotation: 0,
      arrow: "down-left",
    },
  },
  {
    id: "stat",
    label: "Statlabel",
    text: "+1,000,000 STRENGTH",
    overlay: {
      ...DEFAULT_OVERLAY,
      style: "label",
      font: "luckiest-guy",
      sizePercent: 8,
      position: "top",
      fillColor: "#7CFF6B",
      outlineColor: "#0F1A14",
      outlinePercent: 8,
      rotation: 0,
    },
  },
];

const HEX = /^#[0-9a-fA-F]{6}$/;
const ARROW_RED = "#F0222B";

function hex(value: string | undefined, fallback: string) {
  return value && HEX.test(value) ? value : fallback;
}

/** Mix a #RRGGBB color towards black (amount < 0) or white (amount > 0). */
export function shade(color: string, amount: number): string {
  const n = Number.parseInt(color.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount),
  );
  return `#${ch.map((c) => Math.max(0, Math.min(255, c)).toString(16).padStart(2, "0")).join("")}`;
}

function anchor(position: OverlayPosition, width: number, height: number, boxW: number, boxH: number, mx: number, my: number) {
  const x = position.endsWith("left") ? mx : position.endsWith("right") ? width - mx - boxW : (width - boxW) / 2;
  const y = position.startsWith("top") ? my : position.startsWith("bottom") ? height - my - boxH : (height - boxH) / 2;
  return { x, y };
}

export function splitLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_OVERLAY_LINES);
}

/** Curved arrow in a 100×100 box, pointing down-left. */
const ARROW_SHAFT = "M 84 6 C 88 38 64 54 44 66";
const ARROW_HEAD = "M 16 94 L 64 84 L 26 46 Z";

function arrowSvg(direction: Exclude<OverlayArrow, "none">, x: number, y: number, size: number) {
  const s = size / 100;
  const flip = direction === "down-right" ? `translate(${(x + size).toFixed(1)} ${y.toFixed(1)}) scale(${(-s).toFixed(4)} ${s.toFixed(4)})` : `translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s.toFixed(4)})`;
  const layer = (color: string, extra: number) =>
    `<path d="${ARROW_SHAFT}" fill="none" stroke="${color}" stroke-width="${22 + extra}" stroke-linecap="round"/>` +
    `<path d="${ARROW_HEAD}" fill="${color}" stroke="${color}" stroke-width="${extra + 0.01}" stroke-linejoin="round"/>`;
  return `<g transform="${flip}">${layer("#000000", 16)}${layer("#FFFFFF", 10)}${layer(ARROW_RED, 0)}</g>`;
}

export interface OverlayLayout {
  svg: string;
  fontSize: number;
  /** True when the text was shrunk to fit the image. */
  shrunk: boolean;
}

export function buildOverlaySvg(font: Font, overlay: TextOverlay, width: number, height: number): OverlayLayout {
  const style: OverlayStyle = overlay.style ?? "outline";
  const arrow: OverlayArrow = overlay.arrow ?? "none";
  const fill = hex(overlay.fillColor, "#FFFFFF");
  const fill2 = hex(overlay.fillColor2, shade(fill, -0.35));
  const stroke = hex(overlay.outlineColor, "#000000");
  const lines = splitLines(overlay.text);
  const margin = Math.round(Math.min(width, height) * 0.045);

  // Relative measurements (per unit font size) for each look.
  const outlineK = overlay.outlinePercent / 100;
  const depthK = style === "title" ? 0.09 : style === "outline" ? 0.06 : 0;
  const padXK = style === "label" ? 0.45 : 0;
  const padYK = style === "label" ? 0.28 : 0;
  const lineGapK = 0.04;
  const arrowK = arrow === "none" ? 0 : 1.5;

  let fontSize = (height * overlay.sizePercent) / 100;
  let shrunk = false;
  const unitWidth = Math.max(...lines.map((l) => font.getAdvanceWidth(l, 1)), 0.01);
  const unitBlockW = unitWidth + 2 * (outlineK + padXK);
  if (unitBlockW * fontSize > width - margin * 2) {
    fontSize = (width - margin * 2) / unitBlockW;
    shrunk = true;
  }
  // Keep the whole block within ~70% of the image height.
  const approxUnitH = lines.length * (1 + lineGapK) + 2 * (outlineK + padYK) + depthK + arrowK;
  if (approxUnitH * fontSize > height * 0.7) {
    fontSize = (height * 0.7) / approxUnitH;
    shrunk = true;
  }
  fontSize = Math.max(8, fontSize);

  const outline = outlineK * fontSize;
  const depth = depthK * fontSize;
  const padX = padXK * fontSize;
  const padY = padYK * fontSize;
  const lineGap = lineGapK * fontSize;
  const align: "start" | "middle" | "end" = overlay.position.endsWith("left")
    ? "start"
    : overlay.position.endsWith("right")
      ? "end"
      : "middle";

  // Lay out each line from its real glyph bounds.
  const glyphs = lines.map((line) => {
    const p = font.getPath(line, 0, 0, fontSize);
    const bb = p.getBoundingBox();
    return { d: p.toPathData(2), bb, w: bb.x2 - bb.x1, h: bb.y2 - bb.y1 };
  });
  const textW = Math.max(...glyphs.map((g) => g.w), 1);
  const capH = Math.max(...glyphs.map((g) => g.h), 1);
  const textH = glyphs.length * capH + (glyphs.length - 1) * (lineGap + outline);
  const innerW = textW + outline * 2;
  const innerH = textH + outline * 2 + depth;
  const blockW = innerW + padX * 2;
  const blockH = innerH + padY * 2;

  const arrowSize = arrowK * fontSize;
  const totalW = arrow === "none" ? blockW : Math.max(blockW, blockW * 0.5 + arrowSize * 0.85);
  const totalH = blockH + (arrow === "none" ? 0 : arrowSize * 0.95);

  const r = Math.max(-15, Math.min(15, overlay.rotation));
  // Rotation pushes the corners outwards; widen the margins so nothing is clipped.
  const sin = Math.abs(Math.sin((r * Math.PI) / 180));
  const pos = anchor(overlay.position, width, height, totalW, totalH, margin + (totalH / 2) * sin, margin + (totalW / 2) * sin);

  // Where the text block sits inside the total box (the arrow hangs below it).
  let blockX = pos.x;
  if (arrow === "down-left") blockX = pos.x + totalW - blockW;
  const blockY = pos.y;
  const cx = pos.x + totalW / 2;
  const cy = pos.y + totalH / 2;

  // Per-line translate so each glyph box lands in its row, aligned as requested.
  const placed = glyphs.map((g, i) => {
    const rowX =
      align === "start" ? 0 : align === "end" ? textW - g.w : (textW - g.w) / 2;
    const x = blockX + padX + outline + rowX - g.bb.x1;
    const y = blockY + padY + outline + i * (capH + lineGap + outline) + (capH - g.h) - g.bb.y1;
    return { d: g.d, x, y };
  });
  const each = (fn: (p: { d: string; x: number; y: number }) => string) => placed.map(fn).join("");
  const at = (x: number, y: number) => `translate(${x.toFixed(1)} ${y.toFixed(1)})`;
  const sw = (outline * 2).toFixed(1);

  let defs = "";
  let body = "";

  if (style === "title") {
    // Gradient per line, relative to each line's own bounds (objectBoundingBox).
    defs =
      `<linearGradient id="ovl-fill" x1="0" y1="0" x2="0" y2="1">` +
      `<stop offset="0" stop-color="${shade(fill, 0.5)}"/><stop offset="0.35" stop-color="${fill}"/><stop offset="1" stop-color="${fill2}"/></linearGradient>` +
      `<filter id="ovl-glow" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur stdDeviation="${(fontSize * 0.09).toFixed(1)}"/></filter>`;
    const steps = Math.max(2, Math.round(depth / Math.max(1, fontSize * 0.012)));
    const extrude = (paint: string) =>
      Array.from({ length: steps + 1 }, (_, k) => {
        const dy = (depth * k) / steps;
        return each((p) => `<path transform="${at(p.x, p.y + dy)}" d="${p.d}" ${paint}/>`);
      }).join("");
    body =
      // Soft glow in the gradient's warm color.
      `<g filter="url(#ovl-glow)" opacity="0.75">${each((p) => `<path transform="${at(p.x, p.y + depth / 2)}" d="${p.d}" fill="${fill2}" stroke="${fill2}" stroke-width="${(outline * 3.2).toFixed(1)}" stroke-linejoin="round"/>`)}</g>` +
      // Dark rim around the whole extruded shape.
      extrude(`fill="${stroke}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"`) +
      // Side of the letters.
      extrude(`fill="${shade(fill2, -0.45)}"`) +
      // Face with gradient and a thin light edge.
      each((p) => `<path transform="${at(p.x, p.y)}" d="${p.d}" fill="url(#ovl-fill)" stroke="${shade(fill, 0.6)}" stroke-opacity="0.55" stroke-width="${(fontSize * 0.012).toFixed(2)}"/>`);
  } else if (style === "outline") {
    body =
      each((p) => `<path transform="${at(p.x, p.y + depth)}" d="${p.d}" fill="${stroke}" fill-opacity="0.5" stroke="${stroke}" stroke-opacity="0.5" stroke-width="${sw}" stroke-linejoin="round"/>`) +
      (outline > 0 ? each((p) => `<path transform="${at(p.x, p.y)}" d="${p.d}" fill="${stroke}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`) : "") +
      each((p) => `<path transform="${at(p.x, p.y)}" d="${p.d}" fill="${fill}"/>`);
  } else {
    const radius = Math.min(blockH / 2, fontSize * 0.32);
    body =
      `<rect x="${blockX.toFixed(1)}" y="${(blockY + fontSize * 0.06).toFixed(1)}" width="${blockW.toFixed(1)}" height="${blockH.toFixed(1)}" rx="${radius.toFixed(1)}" fill="#000000" fill-opacity="0.35"/>` +
      `<rect x="${blockX.toFixed(1)}" y="${blockY.toFixed(1)}" width="${blockW.toFixed(1)}" height="${blockH.toFixed(1)}" rx="${radius.toFixed(1)}" fill="${stroke}" fill-opacity="0.92" stroke="#FFFFFF" stroke-opacity="0.22" stroke-width="${(fontSize * 0.05).toFixed(1)}"/>` +
      (outline > 0 ? each((p) => `<path transform="${at(p.x, p.y)}" d="${p.d}" fill="#000000" stroke="#000000" stroke-width="${sw}" stroke-linejoin="round"/>`) : "") +
      each((p) => `<path transform="${at(p.x, p.y)}" d="${p.d}" fill="${fill}"/>`);
  }

  if (arrow !== "none") {
    const ax = arrow === "down-left" ? pos.x : pos.x + totalW - arrowSize;
    const ay = blockY + blockH - arrowSize * 0.05;
    body += arrowSvg(arrow, ax, ay, arrowSize);
  }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    (defs ? `<defs>${defs}</defs>` : "") +
    `<g transform="rotate(${r.toFixed(2)} ${cx.toFixed(1)} ${cy.toFixed(1)})">${body}</g></svg>`;

  return { svg, fontSize, shrunk };
}

/** Characters the bundled fonts cannot draw (they only cover Latin). */
export function unsupportedCharacters(font: Font, text: string): string[] {
  const missing = new Set<string>();
  for (const ch of text) {
    if (ch === " " || ch === "\n" || ch === "\r") continue;
    const glyph = font.charToGlyph(ch);
    if (!glyph || glyph.index === 0) missing.add(ch);
  }
  return [...missing];
}
