import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { ASPECT_RATIOS, VISUAL_STYLES, type AspectRatio, type VisualStyle } from "@/types/generation";
import { AppError, toProviderError } from "./errors";
import { COMIC_CALLOUTS, getStyleDef, ROBLOX_HOUSE_LOOK } from "./styles";

/**
 * Prompt enhancement through the official Anthropic Messages API.
 * Claude is used for text only; it does not generate images.
 */

type MessagesClient = Pick<Anthropic, "messages">;

export interface EnhanceInput {
  prompt: string;
  style: VisualStyle;
  aspectRatio: AspectRatio;
  overlayText?: string | null;
}

export interface EnhanceResult {
  enhancedPrompt: string;
  suggestedAspectRatio: AspectRatio | null;
  suggestedStyle: VisualStyle | null;
  note: string | null;
  usage: { inputTokens: number; outputTokens: number };
  model: string;
}

const SYSTEM = `You write image-generation prompts for Roblox game thumbnails.

The target look is that of popular, click-worthy Roblox thumbnails: ${ROBLOX_HOUSE_LOOK}. Typical extras: ${COMIC_CALLOUTS}. Typical compositions: a thief running off with loot while someone chases them, a hero facing a huge boss, before/after transformations, a character proudly holding up a glowing item.

Rewrite the user's idea into one detailed, image-model-friendly description in English (translate if the idea is in another language). Describe, in flowing prose:
- the main subject, its pose and facial expression
- composition, camera angle, foreground and background, depth and visual hierarchy
- lighting, color palette, materials and textures
- the important props and effects (particles, glow outlines, sparks, comic callouts)
- for each character: what kind of Roblox avatar it is, its clothes and its exact facial expression

Rules:
- Keep the user's concept. Do not add new characters, creatures or story elements they did not ask for. You may add environment, lighting and effect details that support the concept.
- Any text the user wants in the image must be kept exactly as written, character for character, inside double quotes.
- Aim for a thumbnail that reads at small sizes: one strong focal point, limited clutter, high contrast.
- No preamble, no lists, no markdown. 60 to 140 words.
- Only suggest a different aspect ratio or style when the idea clearly fits another one better; otherwise return null.
- The note is at most one short sentence in Dutch for the user, or null.`;

const TOOL_NAME = "submit_thumbnail_prompt";

const resultSchema = z.object({
  enhanced_prompt: z.string().min(10).max(4000),
  suggested_aspect_ratio: z.enum(ASPECT_RATIOS).nullable().optional(),
  suggested_style: z.enum(VISUAL_STYLES).nullable().optional(),
  note: z.string().max(300).nullable().optional(),
});

export function createPromptEnhancer(opts: { apiKey: string; model: string; timeoutMs: number; client?: MessagesClient }) {
  const client: MessagesClient =
    opts.client ?? new Anthropic({ apiKey: opts.apiKey, timeout: opts.timeoutMs, maxRetries: 1 });

  return async function enhance(input: EnhanceInput, signal?: AbortSignal): Promise<EnhanceResult> {
    const style = getStyleDef(input.style);
    const userContent = [
      `Idea: ${input.prompt.trim()}`,
      `Chosen style: ${style.label}${style.direction ? ` (${style.direction})` : ""}`,
      style.houseLook ? "Write the description in the Roblox thumbnail look described above." : "",
      `Chosen aspect ratio: ${input.aspectRatio}`,
      input.overlayText
        ? `A title "${input.overlayText.replace(/\s*\n\s*/g, " ")}" will be added afterwards as an overlay, so the image itself must not contain that text.`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    let response: Anthropic.Message;
    try {
      response = await client.messages.create(
        {
          model: opts.model,
          max_tokens: 1024,
          system: SYSTEM,
          tools: [
            {
              name: TOOL_NAME,
              description: "Submit the rewritten thumbnail prompt.",
              input_schema: {
                type: "object",
                properties: {
                  enhanced_prompt: { type: "string", description: "The rewritten English prompt." },
                  suggested_aspect_ratio: { type: ["string", "null"], enum: [...ASPECT_RATIOS, null] },
                  suggested_style: { type: ["string", "null"], enum: [...VISUAL_STYLES, null] },
                  note: { type: ["string", "null"], description: "One short Dutch sentence for the user, or null." },
                },
                required: ["enhanced_prompt", "suggested_aspect_ratio", "suggested_style", "note"],
              },
            },
          ],
          tool_choice: { type: "tool", name: TOOL_NAME },
          messages: [{ role: "user", content: userContent }],
        },
        { signal },
      );
    } catch (err) {
      throw toProviderError(err, "Claude");
    }

    const block = response.content.find((b) => b.type === "tool_use" && b.name === TOOL_NAME);
    const parsed = resultSchema.safeParse(block && "input" in block ? block.input : null);
    if (!parsed.success) {
      throw new AppError("provider_invalid_response", "Claude gaf een onverwacht antwoord. Probeer het opnieuw.");
    }
    const data = parsed.data;
    return {
      enhancedPrompt: data.enhanced_prompt.trim(),
      suggestedAspectRatio:
        data.suggested_aspect_ratio && data.suggested_aspect_ratio !== input.aspectRatio ? data.suggested_aspect_ratio : null,
      suggestedStyle: data.suggested_style && data.suggested_style !== input.style ? data.suggested_style : null,
      note: data.note?.trim() || null,
      usage: { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens },
      model: response.model ?? opts.model,
    };
  };
}

export type PromptEnhancer = ReturnType<typeof createPromptEnhancer>;
