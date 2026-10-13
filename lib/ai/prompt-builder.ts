import type { AspectRatio, OverlayPosition, VisualStyle } from "@/types/generation";
import { styleDirection } from "./styles";

const RATIO_GUIDANCE: Record<AspectRatio, string> = {
  "16:9": "wide 16:9 landscape thumbnail; keep the main subject slightly off-center with room for a title",
  "1:1": "square 1:1 game icon; one centered subject filling most of the frame",
  "4:3": "4:3 thumbnail; balanced framing with the subject large in the frame",
  "9:16": "tall 9:16 vertical artwork; stack the subject vertically and keep the top and bottom readable",
};

const POSITION_WORDS: Record<OverlayPosition, string> = {
  "top-left": "top-left corner",
  top: "top edge",
  "top-right": "top-right corner",
  center: "center",
  "bottom-left": "bottom-left corner",
  bottom: "bottom edge",
  "bottom-right": "bottom-right corner",
};

export interface BuildPromptInput {
  /** What the user typed, or their edited enhanced prompt. Always kept verbatim. */
  description: string;
  style: VisualStyle;
  aspectRatio: AspectRatio;
  /** When set, the title is added afterwards by the overlay renderer. */
  overlay?: { text: string; position: OverlayPosition } | null;
}

/**
 * Wraps the user's description with thumbnail-specific direction. The
 * description itself is never rewritten here — we only add style, framing and
 * readability guidance after it so the requested concept stays intact.
 */
export function buildImagePrompt(input: BuildPromptInput): string {
  const direction = styleDirection(input.style);
  const parts: string[] = [input.description.trim()];

  if (direction) {
    parts.push(`Visual style: ${direction}.`);
  }

  parts.push(
    `Format: Roblox game thumbnail, ${RATIO_GUIDANCE[input.aspectRatio]}.`,
    "Readability: one strong focal point that still reads at small sizes, large expressive characters, limited clutter, high contrast between subject and background, clean silhouettes, subtle glow outlines around the main subject.",
  );

  if (input.overlay && input.overlay.text.trim()) {
    parts.push(
      `Text: do not draw a title, caption, words or watermarks; a title is added afterwards. Signs or logos only where the description above asks for them; small comic symbols such as exclamation marks or sleepy Z's are fine. Keep the ${POSITION_WORDS[input.overlay.position]} free of important details so the title can go there.`,
    );
  } else {
    parts.push(
      "Text: no titles, captions or watermarks unless the description above explicitly asks for them; small comic symbols such as exclamation marks or sleepy Z's are fine.",
    );
  }

  return parts.join("\n\n");
}

/** Prompt for the edit endpoint: the user's instruction plus a guard to keep the rest intact. */
export function buildEditPrompt(instruction: string): string {
  return [
    instruction.trim(),
    "Keep everything that the instruction does not mention the same: characters, composition, camera angle, colors and style. Keep it a high-quality Roblox game thumbnail.",
  ].join("\n\n");
}

export function buildVariationPrompt(originalDescription: string, style: VisualStyle): string {
  const direction = styleDirection(style);
  return [
    "Create a fresh variation of this Roblox game thumbnail: same subject, theme and style, but with a different pose, camera angle or arrangement.",
    `Original description: ${originalDescription.trim()}`,
    direction ? `Visual style: ${direction}.` : "",
    "Do not add titles, captions or watermarks unless the original description asks for them.",
  ]
    .filter(Boolean)
    .join("\n\n");
}
