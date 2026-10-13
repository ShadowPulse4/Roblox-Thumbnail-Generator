import type { AspectRatio, VisualStyle } from "@/types/generation";

/**
 * Visual styles, tuned on the owner's reference thumbnails (see public/examples).
 * What those references share, and what every Roblox style below builds on:
 * glossy 3D Roblox avatars, exaggerated cartoon faces, a white sticker-like
 * outline around the main characters, saturated colors with strong rim light,
 * and comic callouts (shock lines, sweat drops, sparkles, speed lines).
 */
export const ROBLOX_HOUSE_LOOK =
  "high-end glossy 3D render in the style of popular Roblox game thumbnails: blocky Roblox avatars with smooth plastic materials, rounded bevelled edges and classic Roblox proportions, big expressive cartoon faces (smug grins, angry shouting, panicked eyes), a bright white sticker-like rim outline separating the main characters from the background, very saturated colors, strong rim light and soft bloom, crisp clean details";

export const COMIC_CALLOUTS =
  "comic reaction details where they fit the scene: white shock lines next to heads, blue sweat drops, sparkles and glowing yellow emphasis lines around the key item, motion speed lines and small flying debris";

export interface VisualStyleDef {
  id: VisualStyle;
  label: string;
  description: string;
  /** English direction appended to the image prompt. Empty for "custom". */
  direction: string;
  /** Whether the shared Roblox house look and comic callouts are added. */
  houseLook: boolean;
}

export const VISUAL_STYLE_DEFS: VisualStyleDef[] = [
  {
    id: "cinematic-3d",
    label: "Cinematisch 3D",
    description: "Paarse sterrenhemel, gloeiende vloer, filmisch licht.",
    houseLook: true,
    direction:
      "night scene under a deep violet and blue galaxy sky with nebula clouds and pink star sparkles, a glowing purple studded Roblox tile floor stretching to the horizon, magenta and orange rim light, low dramatic camera angle, shallow depth of field",
  },
  {
    id: "steal-chase",
    label: "Stelen en wegrennen",
    description: "Grijnzende dief, boze achtervolger, actie.",
    houseLook: true,
    direction:
      "a smug grinning Roblox avatar sneaking or running away with the stolen item held tight, an angry worker or rival with a wide open shouting mouth chasing with an outstretched hand, dynamic diagonal action composition, the stolen item glowing and highlighted, setting either a bright fast-food restaurant interior with warm red tones and menu boards or a glowing purple studded floor under a starry sky",
  },
  {
    id: "boss-fight",
    label: "Epische baasstrijd",
    description: "Lavamonster, vulkaankasteel, vuur en vonken.",
    houseLook: true,
    direction:
      "epic boss battle: a huge menacing boss with dark scaly skin cracked by glowing molten lava, glowing yellow eyes and jagged glowing teeth, a dark volcanic castle with lava waterfalls, embers and fire sparks in the air, strong orange-versus-purple color contrast, the hero large in the foreground on one side and the boss filling the other side",
  },
  {
    id: "bright-simulator",
    label: "Felle simulator",
    description: "Strakke cartoon, blauwe lucht, grote getallen.",
    houseLook: false,
    direction:
      "clean stylized cartoon 3D render like a popular Roblox simulator thumbnail: smooth simple shapes, soft even lighting, bright blue sky, light gray floor, chunky toy-like props, glossy gold items, small lightning sparkles, clear left-to-right progression, classic yellow-skinned Roblox noob characters with blue shirts and green pants where characters are needed, very readable",
  },
  {
    id: "tycoon",
    label: "Tycoon",
    description: "Machines, lopende banden, stapels geld.",
    houseLook: false,
    direction:
      "clean bright cartoon 3D render of a Roblox tycoon: machines and conveyor belts pushing out stacks of green cash, upgrade signs with arrows, a cheerful owner avatar in a suit, soft sunny indoor lighting, light blue and pastel colors, glossy toy-like materials, tidy readable layout",
  },
  {
    id: "cute-pets",
    label: "Schattige pets",
    description: "Glimmende pets met zeldzaamheidsgloed.",
    houseLook: true,
    direction:
      "adorable chibi Roblox pets with big shiny eyes and rounded toy-like shapes, a rarity glow aura and sparkles around the special pet, a starry purple sky or sunny pastel background, a delighted Roblox avatar presenting the pet",
  },
  {
    id: "anime",
    label: "Anime-stijl",
    description: "Cel-shading, speedlines en energie.",
    houseLook: false,
    direction:
      "anime-inspired Roblox characters, cel-shaded rendering, bold ink outlines, dynamic speed lines, energy aura, vivid gradients, dramatic action pose",
  },
  {
    id: "minimal-icon",
    label: "Game-icoon",
    description: "Eén of twee figuren dichtbij, voor je game-icoon.",
    houseLook: true,
    direction:
      "Roblox game icon composition: one or two avatars very close to the camera filling most of the frame, the key item held up high and glowing with yellow emphasis lines, a simple bright slightly blurred background, nothing small or busy",
  },
  {
    id: "realistic-3d",
    label: "Realistisch 3D",
    description: "Echte materialen en natuurlijk licht.",
    houseLook: false,
    direction:
      "realistic physically based 3D rendering of Roblox-style characters and props, detailed materials and textures, natural global illumination, photographic depth of field",
  },
  {
    id: "custom",
    label: "Eigen stijl",
    description: "Alleen jouw prompt, geen extra stijl.",
    houseLook: false,
    direction: "",
  },
];

export function getStyleDef(id: VisualStyle): VisualStyleDef {
  return VISUAL_STYLE_DEFS.find((s) => s.id === id) ?? VISUAL_STYLE_DEFS[0];
}

/** The full style text that goes into the image prompt, house look included. */
export function styleDirection(id: VisualStyle): string {
  const def = getStyleDef(id);
  if (!def.direction) return "";
  return def.houseLook ? `${ROBLOX_HOUSE_LOOK}; ${def.direction}; ${COMIC_CALLOUTS}` : def.direction;
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
  /** Which look from OVERLAY_PRESETS the title gets. */
  overlayLook?: "gold" | "fire" | "you" | "stat";
  /** One of the owner's reference thumbnails in public/examples, when one fits. */
  example?: string;
  /** Two colors for the placeholder illustration when there is no example. */
  colors: [string, string];
  icon: "swords" | "paw" | "hand" | "zap" | "factory" | "sparkles" | "ghost" | "gift" | "square" | "megaphone";
}

// The recurring player avatar in the reference thumbnails.
const PLAYER = "A smug Roblox avatar with messy orange hair, a black open jacket over a blue t-shirt and dark green patterned pants";

export const STYLE_PRESETS: StylePreset[] = [
  {
    id: "lava-dragon",
    category: "Baasgevechten",
    name: "Nuggetkoning tegen lavadraak",
    description: "Een boze baas tegenover een gigantische draak.",
    prompt:
      "An angry crispy chicken nugget king with a golden crown made of fries, a red royal cape, white cartoon gloves and a silver fork as a trident, standing ready to fight a giant black lava dragon with glowing molten cracks roaring in a burning volcanic castle arena",
    style: "boss-fight",
    aspectRatio: "16:9",
    overlayText: "EPIC\nBOSSES",
    overlayLook: "gold",
    example: "boss-nugget-king.webp",
    colors: ["#ff7a2f", "#7a1fff"],
    icon: "swords",
  },
  {
    id: "restaurant-chase",
    category: "Steal-games",
    name: "Nuggets roven",
    description: "Wegrennen met de nuggets, de medewerker erachteraan.",
    prompt: `${PLAYER} running out of a fast-food restaurant with a red box full of chicken nuggets, grinning and eating one, an angry worker in a red uniform and cap reaching over the counter after him, nuggets falling on the floor`,
    style: "steal-chase",
    aspectRatio: "16:9",
    overlayText: "YOU!",
    overlayLook: "you",
    example: "restaurant-chase.webp",
    colors: ["#ff3b3b", "#ffcc33"],
    icon: "hand",
  },
  {
    id: "sneaky-grab",
    category: "Steal-games",
    name: "Stiekem pakken",
    description: "Een nugget pakken terwijl de medewerker slaapt.",
    prompt: `${PLAYER} sneakily grabbing a glowing chicken nugget from a red box on the counter while the fast-food worker sleeps with his head on the counter, drooling, blue Z's above his head, red neon restaurant interior`,
    style: "steal-chase",
    aspectRatio: "16:9",
    example: "sneaky-grab.webp",
    colors: ["#e8202a", "#2a0a0a"],
    icon: "hand",
  },
  {
    id: "space-chase",
    category: "Steal-games",
    name: "Achtervolging op de paarse baan",
    description: "Een noob rent weg met een enorme nugget.",
    prompt:
      "A scared yellow Roblox noob running away clutching a giant crispy chicken nugget, an angry fast-food worker in a red shirt and black cap chasing him with an outstretched hand, pink speed lines, nugget crumbs flying, glowing purple studded floor under a starry purple sky",
    style: "steal-chase",
    aspectRatio: "16:9",
    overlayText: "YOU",
    overlayLook: "you",
    example: "space-chase.webp",
    colors: ["#a43bff", "#ff8a00"],
    icon: "hand",
  },
  {
    id: "dragon-egg",
    category: "Pets",
    name: "Het drakenei",
    description: "Een gloeiend ei stelen van een slapende draak.",
    prompt: `${PLAYER} triumphantly holding a glowing black dragon egg with small orange wings above his head, golden sparkles around the egg, a huge black lava dragon sleeping behind him with big blue Z's, starry purple sky and glowing purple studded floor`,
    style: "cute-pets",
    aspectRatio: "16:9",
    example: "dragon-egg.webp",
    colors: ["#5b2bff", "#ff7a00"],
    icon: "paw",
  },
  {
    id: "power-sim",
    category: "Simulator-games",
    name: "Van zwak naar sterk",
    description: "Voor en na, met grote getallen erboven.",
    prompt:
      "On the left a weak worried yellow Roblox noob holding tiny dumbbells, on the right the same noob huge and muscular confidently lifting a giant golden barbell with lightning sparkles, a big curved white arrow pointing from left to right, bright outdoor gym with weight racks",
    style: "bright-simulator",
    aspectRatio: "16:9",
    overlayText: "+1,000,000 STRENGTH",
    overlayLook: "stat",
    example: "strength-sim.webp",
    colors: ["#3ad0ff", "#ffe14d"],
    icon: "zap",
  },
  {
    id: "money-tycoon",
    category: "Tycoon-games",
    name: "Geldprinter",
    description: "Een machine die stapels geld uitspuugt.",
    prompt:
      "A cheerful Roblox businessman avatar in a black suit and top hat next to a big money printing machine pushing stacks of green cash along a conveyor belt into a vault, upgrade signs with green and yellow arrows, colorful machines in the background",
    style: "tycoon",
    aspectRatio: "16:9",
    overlayText: "MONEY PRINTING\nTYCOON",
    overlayLook: "gold",
    example: "money-tycoon.webp",
    colors: ["#2fd17a", "#ffb800"],
    icon: "factory",
  },
  {
    id: "game-icon",
    category: "Game-iconen",
    name: "Icoon met de buit",
    description: "Dichtbij, de buit hoog in de lucht.",
    prompt: `${PLAYER} sitting on sand holding a giant glowing chicken nugget high above his head with a sly grin, an angry fast-food worker with a cap shouting behind him, red exclamation marks, a fast-food restaurant and blocky palm trees under a blue sky`,
    style: "minimal-icon",
    aspectRatio: "1:1",
    example: "icon-nugget-king.webp",
    colors: ["#ffd23f", "#7c5cff"],
    icon: "square",
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
    description: "Pompoenen, mist en een griezelige baas.",
    prompt:
      "A giant jack-o-lantern boss with glowing orange eyes towering over a scared Roblox avatar holding a bag of candy, purple fog, floating ghosts, spooky castle under a full moon",
    style: "boss-fight",
    aspectRatio: "16:9",
    overlayText: "HALLOWEEN\nEVENT",
    overlayLook: "fire",
    colors: ["#ff8a00", "#4b1f7a"],
    icon: "ghost",
  },
  {
    id: "christmas",
    category: "Kerst-events",
    name: "Winterwonderland",
    description: "Sneeuw, cadeaus en een feestelijke update.",
    prompt:
      "A giant glowing present box bursting open with magical light in a snowy Roblox village, a delighted Roblox avatar in a santa hat jumping with joy, snow falling, warm string lights",
    style: "cinematic-3d",
    aspectRatio: "16:9",
    overlayText: "CHRISTMAS\nUPDATE",
    overlayLook: "gold",
    colors: ["#e8323c", "#1f9e6a"],
    icon: "gift",
  },
  {
    id: "update",
    category: "Update-aankondigingen",
    name: "Nieuwe werelden",
    description: "Een portaal naar nieuwe biomen voor je update.",
    prompt:
      "A Roblox avatar stepping toward a huge glowing portal that reveals new colorful biomes behind it: ice, lava, jungle, candy and space, arranged along one long lane",
    style: "cinematic-3d",
    aspectRatio: "16:9",
    overlayText: "10 NEW\nBIOMES!",
    overlayLook: "gold",
    colors: ["#22c1ff", "#a43bff"],
    icon: "megaphone",
  },
];
