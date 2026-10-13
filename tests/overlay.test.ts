import fs from "node:fs";
import path from "node:path";
import { parse } from "opentype.js";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { buildOverlaySvg, DEFAULT_OVERLAY, OVERLAY_PRESETS, shade, splitLines } from "@/lib/overlay/layout";
import { renderOverlay } from "@/lib/overlay/render";
import { STYLE_PRESETS, VISUAL_STYLE_DEFS } from "@/lib/ai/styles";
import { VISUAL_STYLES } from "@/types/generation";
import { makePng } from "./helpers/env";

const buf = fs.readFileSync(path.join(process.cwd(), "public/fonts/luckiest-guy.woff"));
const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const preset = (id: string) => OVERLAY_PRESETS.find((p) => p.id === id)!.overlay;

describe("overlay layout", () => {
  it("draws a 3D title with a gradient face, extrusion and glow", () => {
    const { svg } = buildOverlaySvg(font, { ...DEFAULT_OVERLAY, text: "EPIC\nBOSSES" }, 1920, 1080);
    expect(svg).toContain("<linearGradient");
    expect(svg).toContain('fill="url(#ovl-fill)"');
    expect(svg).toContain("feGaussianBlur");
    // Two lines are laid out as separate face paths.
    expect(svg.match(/fill="url\(#ovl-fill\)"/g)).toHaveLength(2);
  });

  it("draws a label box behind label text", () => {
    const { svg } = buildOverlaySvg(font, { ...preset("stat"), text: "+1,000,000 STRENGTH" }, 1920, 1080);
    expect(svg).toContain("<rect");
    expect(svg).not.toContain("linearGradient");
  });

  it("adds a red callout arrow when asked", () => {
    const withArrow = buildOverlaySvg(font, { ...preset("you"), text: "YOU" }, 1920, 1080).svg;
    expect(withArrow).toContain("#F0222B");
    const without = buildOverlaySvg(font, { ...preset("you"), text: "YOU", arrow: "none" }, 1920, 1080).svg;
    expect(without).not.toContain("#F0222B");
  });

  it("shrinks long text to fit the image", () => {
    const res = buildOverlaySvg(font, { ...DEFAULT_OVERLAY, sizePercent: 30, text: "THIS IS A VERY LONG TITLE TEXT" }, 1024, 1024);
    expect(res.shrunk).toBe(true);
  });

  it("renders older overlays without the new fields", () => {
    const { svg } = buildOverlaySvg(
      font,
      { text: "OLD", font: "luckiest-guy", sizePercent: 12, position: "top", fillColor: "#FFFFFF", outlineColor: "#000000", outlinePercent: 10, rotation: 0 },
      800,
      450,
    );
    expect(svg).toContain("<path");
    expect(svg).not.toContain("linearGradient");
  });

  it("splits lines and caps them at three", () => {
    expect(splitLines(" A \n\nB\nC\nD")).toEqual(["A", "B", "C"]);
  });

  it("shades colors towards black and white", () => {
    expect(shade("#808080", -0.5)).toBe("#404040");
    expect(shade("#000000", 1)).toBe("#ffffff");
  });

  it("renders every look onto a real image with sharp", async () => {
    const base = await makePng(1920, 1080, "#5b1fff");
    for (const p of OVERLAY_PRESETS) {
      const out = await renderOverlay(base, { ...p.overlay, text: p.text ?? "EPIC\nBOSSES" });
      expect([out.width, out.height]).toEqual([1920, 1080]);
      const stats = await sharp(out.data).stats();
      // Something was drawn: the image is no longer a single flat color.
      expect(stats.channels[0].stdev).toBeGreaterThan(1);
    }
  });
});

describe("style presets", () => {
  it("every style has a definition and every preset uses a valid style", () => {
    expect(VISUAL_STYLE_DEFS.map((s) => s.id).sort()).toEqual([...VISUAL_STYLES].sort());
    for (const p of STYLE_PRESETS) expect(VISUAL_STYLES).toContain(p.style);
  });

  it("example images referenced by presets exist", () => {
    for (const p of STYLE_PRESETS.filter((p) => p.example)) {
      expect(fs.existsSync(path.join(process.cwd(), "public/examples", p.example!))).toBe(true);
    }
  });
});
