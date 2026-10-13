import { describe, expect, it } from "vitest";
import {
  editRequestSchema,
  generateRequestSchema,
  overlaySchema,
} from "@/lib/validation/schemas";
import { buildEditPrompt, buildImagePrompt } from "@/lib/ai/prompt-builder";
import { downloadFilename } from "@/lib/download";

const base = { aspectRatio: "16:9", style: "cinematic-3d", quality: "standard", count: 1 } as const;

describe("prompt validation", () => {
  const schema = generateRequestSchema(100);

  it("rejects an empty or whitespace-only prompt", () => {
    expect(schema.safeParse({ ...base, prompt: "" }).success).toBe(false);
    expect(schema.safeParse({ ...base, prompt: "    " }).success).toBe(false);
  });

  it("rejects prompts over the configured maximum", () => {
    const r = schema.safeParse({ ...base, prompt: "a".repeat(101) });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].message).toContain("100");
  });

  it("accepts a normal prompt and trims it", () => {
    const r = schema.safeParse({ ...base, prompt: "  dragon fight  " });
    expect(r.success).toBe(true);
    expect(r.data?.prompt).toBe("dragon fight");
  });

  it("only allows 1, 2 or 4 images", () => {
    expect(schema.safeParse({ ...base, prompt: "dragon", count: 3 }).success).toBe(false);
    expect(schema.safeParse({ ...base, prompt: "dragon", count: 8 }).success).toBe(false);
    expect(schema.safeParse({ ...base, prompt: "dragon", count: 4 }).success).toBe(true);
  });

  it("rejects unknown styles and aspect ratios", () => {
    expect(schema.safeParse({ ...base, prompt: "dragon", style: "vaporwave" }).success).toBe(false);
    expect(schema.safeParse({ ...base, prompt: "dragon", aspectRatio: "21:9" }).success).toBe(false);
  });

  it("validates overlay colors and ranges", () => {
    const ok = { text: "NEW UPDATE!", font: "anton", sizePercent: 12, position: "top", fillColor: "#FFFFFF", outlineColor: "#000000", outlinePercent: 10, rotation: 0 };
    expect(overlaySchema.safeParse(ok).success).toBe(true);
    expect(overlaySchema.safeParse({ ...ok, fillColor: "red" }).success).toBe(false);
    expect(overlaySchema.safeParse({ ...ok, sizePercent: 90 }).success).toBe(false);
    expect(overlaySchema.safeParse({ ...ok, text: "x".repeat(41) }).success).toBe(false);
  });

  it("requires a uuid image id for edits", () => {
    expect(editRequestSchema.safeParse({ imageId: "../../etc/passwd", instruction: "make it purple", quality: "standard" }).success).toBe(false);
  });
});

describe("prompt builder", () => {
  it("keeps the user's description verbatim at the start", () => {
    const description = "An angry golden nugget king fighting a giant lava dragon";
    const out = buildImagePrompt({ description, style: "boss-fight", aspectRatio: "16:9" });
    expect(out.startsWith(description)).toBe(true);
    expect(out).toContain("16:9");
  });

  it("tells the model not to draw text when the overlay adds it afterwards", () => {
    const out = buildImagePrompt({
      description: "a pet",
      style: "cute-pets",
      aspectRatio: "1:1",
      overlay: { text: "SPECIAL PET", position: "bottom-left" },
    });
    expect(out).toContain("do not draw any text");
    expect(out).toContain("bottom-left corner");
    // The overlay wording itself is not sent to the image model.
    expect(out).not.toContain("SPECIAL PET");
  });

  it("adds no style direction for the custom style", () => {
    const out = buildImagePrompt({ description: "my idea", style: "custom", aspectRatio: "4:3" });
    expect(out).not.toContain("Visual style");
  });

  it("keeps edit instructions first and asks to preserve the rest", () => {
    const out = buildEditPrompt("Change the background to purple");
    expect(out.startsWith("Change the background to purple")).toBe(true);
    expect(out).toContain("Keep everything");
  });
});

describe("download filename", () => {
  it("uses the date and a short id", () => {
    const name = downloadFilename(new Date(2026, 9, 13, 12), "1a2b3c4d-0000-0000-0000-000000000000");
    expect(name).toBe("roblox-thumbnail-2026-10-13-1a2b3c.png");
  });

  it("never lets unsafe characters into the filename", () => {
    const name = downloadFilename(new Date(2026, 0, 2), '"; rm -rf', 'png"');
    expect(name).toMatch(/^roblox-thumbnail-2026-01-02-[a-z0-9]+\.png$/i);
  });
});
