import type { AspectRatio, VisualStyle } from "@/types/generation";

export interface VisualStyleDef {
  id: VisualStyle;
  label: string;
  description: string;
  /** English direction appended to the image prompt. Empty for "custom". */
  direction: string;
}

export const VISUAL_STYLE_DEFS: VisualStyleDef[] = [
  {
    id: "cinematic-3d",
    label: "Cinematisch 3D",
    description: "Filmische belichting, diepte en drama.",
    direction:
      "high-end 3D render of blocky Roblox-style characters with smooth plastic materials, cinematic rim lighting, volumetric light beams, shallow depth of field, rich saturated colors, dramatic low camera angle",
  },
  {
    id: "bright-simulator",
    label: "Felle simulator",
    description: "Zonnig, kleurrijk en vrolijk.",
    direction:
      "bright cheerful Roblox simulator game look, sunny sky, candy-saturated colors, glossy collectibles, sparkles and floating coins, soft global illumination, clean readable shapes",
  },
  {
    id: "boss-fight",
    label: "Epische baasstrijd",
    description: "Groot monster, actie, gloed en vonken.",
    direction:
      "epic boss battle composition, a huge menacing boss towering over a small brave Roblox hero, glowing eyes, fire and energy particles, strong orange and purple contrast, motion and impact effects",
  },
  {
    id: "cute-pets",
    label: "Schattige pets",
    description: "Ronde, glanzende huisdieren met sterretjes.",
    direction:
      "adorable chibi Roblox pets with big shiny eyes, rounded toy-like shapes, pastel and vivid accents, rarity glow and sparkles, soft studio lighting, cozy background",
  },
  {
    id: "tycoon",
    label: "Tycoon",
    description: "Geld, fabrieken en groeiende rijkdom.",
    direction:
      "Roblox tycoon game scene, conveyor belts, piles of cash and gold, upgrading factory buildings, excited character, warm golden lighting, sense of growth and wealth",
  },
  {
    id: "anime",
    label: "Anime-stijl",
    description: "Cel-shading, speedlines en energie.",
    direction:
      "anime-inspired Roblox characters, cel-shaded rendering, bold ink outlines, dynamic speed lines, energy aura, vivid gradients, dramatic action pose",
  },
  {
    id: "realistic-3d",
    label: "Realistisch 3D",
    description: "Echte materialen en natuurlijk licht.",
    direction:
      "realistic physically based 3D rendering of Roblox-style characters and props, detailed materials and textures, natural global illumination, photographic depth of field",
  },
  {
    id: "minimal-icon",
    label: "Minimaal icoon",
    description: "Eén object, strak, voor game-iconen.",
    direction:
      "minimal Roblox game icon, one bold centered subject, simple gradient background, thick clean silhouette, strong outline glow, no clutter",
  },
  {
    id: "custom",
    label: "Eigen stijl",
    description: "Alleen jouw prompt, geen extra stijl.",
    direction: "",
  },
];

export function getStyleDef(id: VisualStyle): VisualStyleDef {
  return VISUAL_STYLE_DEFS.find((s) => s.id === id) ?? VISUAL_STYLE_DEFS[0];
}

export const ASPECT_RATIO_DEFS: { id: AspectRatio; label: string; hint: string }[] = [
  { id: "16:9", label: "16:9", hint: "YouTube en liggend" },
  { id: "1:1", label: "1:1", hint: "Game-icoon" },
  { id: "4:3", label: "4:3", hint: "Alternatief formaat" },
  { id: "9:16", label: "9:16", hint: "Shorts en TikTok" },
];

export interface StylePreset {
  id: string;
  category: string;
  name: string;
  description: string;
  prompt: string;
  style: VisualStyle;
  aspectRatio: AspectRatio;
  overlayText?: string;
  /** Two colors for the placeholder illustration. */
  colors: [string, string];
  icon: "swords" | "paw" | "hand" | "zap" | "factory" | "sparkles" | "ghost" | "gift" | "square" | "megaphone";
}

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "lava-dragon",
    category: "Baasgevechten",
    name: "Lavadraak-arena",
    description: "Een held tegenover een gigantische baas in een vulkaan.",
    prompt:
      "An angry golden nugget king fighting a giant lava dragon in an epic volcanic arena, sparks and embers flying, the dragon roaring with glowing eyes",
    style: "boss-fight",
    aspectRatio: "16:9",
    overlayText: "EPIC BOSS!",
    colors: ["#ff7a2f", "#7a1fff"],
    icon: "swords",
  },
  {
    id: "rare-pet",
    category: "Pets",
    name: "Zeldzame pet-onthulling",
    description: "Een glimmende legendarische pet die uit een ei komt.",
    prompt:
      "A legendary rainbow dragon pet hatching from a glowing golden egg, surprised Roblox player in the background, sparkles and rarity beams",
    style: "cute-pets",
    aspectRatio: "16:9",
    overlayText: "SPECIAL PET",
    colors: ["#ff8fd1", "#5b7cff"],
    icon: "paw",
  },
  {
    id: "steal-nugget",
    category: "Steal-games",
    name: "Nugget-roof",
    description: "Een sluipende speler die een gouden nugget wegkaapt.",
    prompt:
      "A sneaky Roblox player running away with a giant glowing golden nugget on their back, holding a spatula, an angry rival chasing behind, traps on a long lane",
    style: "cinematic-3d",
    aspectRatio: "16:9",
    overlayText: "STEAL IT!",
    colors: ["#ffcc33", "#1f8a5b"],
    icon: "hand",
  },
  {
    id: "power-sim",
    category: "Simulator-games",
    name: "Krachtsimulator",
    description: "Een gespierde avatar met enorme getallen en gloed.",
    prompt:
      "A super muscular Roblox avatar lifting a gigantic glowing dumbbell, huge power numbers floating around, energy explosion, bright sky arena",
    style: "bright-simulator",
    aspectRatio: "16:9",
    overlayText: "600K P/S",
    colors: ["#3ad0ff", "#ffe14d"],
    icon: "zap",
  },
  {
    id: "money-tycoon",
    category: "Tycoon-games",
    name: "Miljonair-fabriek",
    description: "Lopende banden vol goud en een blije eigenaar.",
    prompt:
      "A happy Roblox tycoon owner standing in front of a huge golden factory, conveyor belts full of cash and gold bars, money raining down",
    style: "tycoon",
    aspectRatio: "16:9",
    overlayText: "NEW UPDATE!",
    colors: ["#2fd17a", "#ffb800"],
    icon: "factory",
  },
  {
    id: "anime-clash",
    category: "Anime",
    name: "Anime-confrontatie",
    description: "Twee strijders met aura's die op elkaar botsen.",
    prompt:
      "Two Roblox anime fighters clashing swords mid-air, blue and red energy auras colliding, speed lines, shattered ground below",
    style: "anime",
    aspectRatio: "16:9",
    colors: ["#2f6bff", "#ff3b5c"],
    icon: "sparkles",
  },
  {
    id: "halloween",
    category: "Halloween-events",
    name: "Spookachtig event",
    description: "Pompoenen, mist en een griezelige gast.",
    prompt:
      "A spooky Halloween event in a Roblox world, giant jack-o-lantern boss, purple fog, floating ghosts, scared but excited player holding candy",
    style: "cinematic-3d",
    aspectRatio: "16:9",
    overlayText: "HALLOWEEN EVENT",
    colors: ["#ff8a00", "#4b1f7a"],
    icon: "ghost",
  },
  {
    id: "christmas",
    category: "Kerst-events",
    name: "Winterwonderland",
    description: "Sneeuw, cadeaus en een feestelijke update.",
    prompt:
      "A cozy Christmas winter wonderland in a Roblox world, giant glowing present box opening with magical light, snow falling, festive player in a santa hat",
    style: "bright-simulator",
    aspectRatio: "16:9",
    overlayText: "CHRISTMAS UPDATE",
    colors: ["#e8323c", "#1f9e6a"],
    icon: "gift",
  },
  {
    id: "game-icon",
    category: "Game-iconen",
    name: "Strak icoon",
    description: "Eén herkenbaar object op een egale achtergrond.",
    prompt: "A shiny golden nugget with a tiny crown, centered, glowing outline",
    style: "minimal-icon",
    aspectRatio: "1:1",
    colors: ["#ffd23f", "#7c5cff"],
    icon: "square",
  },
  {
    id: "update",
    category: "Update-aankondigingen",
    name: "Nieuwe werelden",
    description: "Een portaal naar nieuwe biomen voor je update.",
    prompt:
      "A Roblox player stepping toward a huge glowing portal that reveals ten new colorful biomes — ice, lava, jungle, candy and space — arranged behind it",
    style: "cinematic-3d",
    aspectRatio: "16:9",
    overlayText: "10 NEW BIOMES!",
    colors: ["#22c1ff", "#a43bff"],
    icon: "megaphone",
  },
];
