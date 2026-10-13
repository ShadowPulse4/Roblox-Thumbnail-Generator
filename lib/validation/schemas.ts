import { z } from "zod";
import {
  ASPECT_RATIOS,
  OVERLAY_ARROWS,
  OVERLAY_STYLES,
  IMAGE_COUNTS,
  OVERLAY_FONTS,
  OVERLAY_POSITIONS,
  QUALITY_LEVELS,
  VISUAL_STYLES,
} from "@/types/generation";
import { MAX_OVERLAY_LINES } from "@/lib/overlay/layout";

/** Shared between the browser (instant feedback) and the server (the real check). */

export const MIN_PROMPT_LENGTH = 3;
export const MAX_OVERLAY_TEXT = 40;
export const MAX_EDIT_INSTRUCTION = 1000;

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Gebruik een kleur als #RRGGBB.");

export const overlaySchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Vul de tekst voor de overlay in.")
    .max(MAX_OVERLAY_TEXT, `De overlaytekst mag maximaal ${MAX_OVERLAY_TEXT} tekens zijn.`)
    .refine((t) => t.split(/\r?\n/).filter((l) => l.trim()).length <= MAX_OVERLAY_LINES, {
      message: `Maximaal ${MAX_OVERLAY_LINES} regels tekst.`,
    }),
  style: z.enum(OVERLAY_STYLES).default("outline"),
  font: z.enum(OVERLAY_FONTS),
  sizePercent: z.number().min(4).max(30),
  position: z.enum(OVERLAY_POSITIONS),
  fillColor: hexColor,
  outlineColor: hexColor,
  outlinePercent: z.number().min(0).max(25),
  rotation: z.number().min(-15).max(15),
  fillColor2: hexColor.optional(),
  arrow: z.enum(OVERLAY_ARROWS).default("none"),
});

export function promptSchema(maxLength: number) {
  return z
    .string()
    .trim()
    .min(MIN_PROMPT_LENGTH, "Beschrijf je thumbnail in minstens een paar woorden.")
    .max(maxLength, `Je prompt is te lang (maximaal ${maxLength} tekens).`);
}

export function generateRequestSchema(maxPromptLength: number) {
  return z.object({
    prompt: promptSchema(maxPromptLength),
    /** What the user typed before "Prompt verbeteren", when they used it. */
    originalPrompt: z.string().trim().max(maxPromptLength).nullable().optional(),
    aspectRatio: z.enum(ASPECT_RATIOS),
    style: z.enum(VISUAL_STYLES),
    quality: z.enum(QUALITY_LEVELS),
    count: z.union(IMAGE_COUNTS.map((n) => z.literal(n)) as [z.ZodLiteral<1>, z.ZodLiteral<2>, z.ZodLiteral<4>]),
    overlay: overlaySchema.nullable().optional(),
  });
}

export const editRequestSchema = z.object({
  imageId: z.string().uuid(),
  instruction: z
    .string()
    .trim()
    .min(MIN_PROMPT_LENGTH, "Beschrijf wat er moet veranderen.")
    .max(MAX_EDIT_INSTRUCTION, `Maximaal ${MAX_EDIT_INSTRUCTION} tekens.`),
  quality: z.enum(QUALITY_LEVELS),
});

export const variationRequestSchema = z.object({
  imageId: z.string().uuid(),
  count: z.union([z.literal(1), z.literal(2), z.literal(4)]),
  quality: z.enum(QUALITY_LEVELS),
});

export const overlayRequestSchema = z.object({
  imageId: z.string().uuid(),
  overlay: overlaySchema,
});

export function enhanceRequestSchema(maxPromptLength: number) {
  return z.object({
    prompt: promptSchema(maxPromptLength),
    aspectRatio: z.enum(ASPECT_RATIOS),
    style: z.enum(VISUAL_STYLES),
    overlayText: z.string().trim().max(MAX_OVERLAY_TEXT).nullable().optional(),
  });
}

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Gebruikersnaam: minstens 3 tekens.")
  .max(32, "Gebruikersnaam: maximaal 32 tekens.")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Gebruikersnaam: alleen letters, cijfers, punt, streepje en underscore.");

export const passwordSchema = z
  .string()
  .min(10, "Wachtwoord: minstens 10 tekens.")
  .max(200, "Wachtwoord is te lang.");

export const loginSchema = z.object({
  username: z.string().trim().min(1, "Vul je gebruikersnaam in.").max(64),
  password: z.string().min(1, "Vul je wachtwoord in.").max(200),
});

export const createUserSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Vul een naam in.").max(60),
  password: passwordSchema,
  role: z.enum(["admin", "member"]),
  dailyImageLimit: z.number().int().min(0).max(1000).nullable(),
});

export const updateUserSchema = z.object({
  displayName: z.string().trim().min(1).max(60).optional(),
  password: passwordSchema.optional(),
  role: z.enum(["admin", "member"]).optional(),
  dailyImageLimit: z.number().int().min(0).max(1000).nullable().optional(),
});

export const setupSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1, "Vul een naam in.").max(60),
  password: passwordSchema,
});
