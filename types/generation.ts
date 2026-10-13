// Shared types used by both the client and the server.

export const ASPECT_RATIOS = ["16:9", "1:1", "4:3", "9:16"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

export const VISUAL_STYLES = [
  "cinematic-3d",
  "bright-simulator",
  "boss-fight",
  "cute-pets",
  "tycoon",
  "anime",
  "realistic-3d",
  "minimal-icon",
  "custom",
] as const;
export type VisualStyle = (typeof VISUAL_STYLES)[number];

/** App-level quality tiers. Each provider maps these to its own real setting. */
export const QUALITY_LEVELS = ["standard", "high", "ultra"] as const;
export type QualityLevel = (typeof QUALITY_LEVELS)[number];

export const IMAGE_COUNTS = [1, 2, 4] as const;
export type ImageCount = (typeof IMAGE_COUNTS)[number];

export type GenerationKind = "generate" | "edit" | "variation";
export type GenerationStatus = "pending" | "running" | "succeeded" | "failed";

export const OVERLAY_FONTS = ["luckiest-guy", "anton"] as const;
export type OverlayFont = (typeof OVERLAY_FONTS)[number];

export const OVERLAY_POSITIONS = [
  "top-left",
  "top",
  "top-right",
  "center",
  "bottom-left",
  "bottom",
  "bottom-right",
] as const;
export type OverlayPosition = (typeof OVERLAY_POSITIONS)[number];

export interface TextOverlay {
  text: string;
  font: OverlayFont;
  /** Font size as a percentage of the image height (4–30). */
  sizePercent: number;
  position: OverlayPosition;
  fillColor: string;
  outlineColor: string;
  /** Outline width as a percentage of the font size (0–25). */
  outlinePercent: number;
  /** Rotation in degrees (-15 to 15), thumbnails often tilt text slightly. */
  rotation: number;
}

export interface GeneratedImageDTO {
  id: string;
  generationId: string;
  width: number;
  height: number;
  format: string;
  createdAt: string;
  isFavorite: boolean;
  parentImageId: string | null;
  overlay: TextOverlay | null;
  /** Authenticated URL served by the app, never a raw storage path. */
  url: string;
}

export interface GenerationDTO {
  id: string;
  kind: GenerationKind;
  prompt: string;
  enhancedPrompt: string | null;
  finalPrompt: string;
  aspectRatio: AspectRatio;
  visualStyle: VisualStyle;
  quality: QualityLevel;
  imageCount: number;
  imageProvider: string;
  imageModel: string;
  providerQuality: string;
  status: GenerationStatus;
  errorCode: string | null;
  errorMessage: string | null;
  parentImageId: string | null;
  overlay: TextOverlay | null;
  createdAt: string;
  completedAt: string | null;
  images: GeneratedImageDTO[];
}

export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  role: "admin" | "member";
}

export interface AppStatus {
  appName: string;
  mode: "local-open" | "accounts";
  isProduction: boolean;
  openAccessBlocked: boolean;
  user: PublicUser | null;
  image: {
    configured: boolean;
    provider: string;
    model: string;
    capabilities: ProviderCapabilitiesDTO | null;
  };
  text: {
    configured: boolean;
    provider: "anthropic";
    model: string;
  };
  limits: {
    maxPromptLength: number;
    maxImagesPerRequest: number;
    dailyImageLimit: number | null;
    imagesToday: number;
  };
}

export interface ProviderCapabilitiesDTO {
  edit: boolean;
  variations: boolean;
  /** Quality levels this model actually distinguishes, mapped to the provider value. */
  quality: Partial<Record<QualityLevel, string>>;
  maxImagesPerRequest: number;
  aspectRatios: Partial<Record<AspectRatio, { width: number; height: number; cropped: boolean }>>;
  negativePrompt: boolean;
}

export interface UsageSummaryDTO {
  today: UsageTotals;
  month: UsageTotals;
  limits: {
    dailySpendUsd: number | null;
    monthlySpendUsd: number | null;
    dailyImagesPerUser: number | null;
  };
  byDay: { day: string; images: number; estimatedUsd: number }[];
  recent: UsageRecordDTO[];
  scope: "self" | "all";
}

export interface UsageTotals {
  images: number;
  requests: number;
  estimatedUsd: number;
  confirmedUsd: number;
  unknownCostRequests: number;
}

export interface UsageRecordDTO {
  id: string;
  createdAt: string;
  username: string | null;
  provider: string;
  model: string;
  operation: string;
  imageCount: number;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: number | null;
  costStatus: "estimated" | "confirmed" | "unknown";
}
