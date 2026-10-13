import type { AspectRatio, ProviderCapabilitiesDTO, QualityLevel } from "./generation";

export type ProviderCapabilities = ProviderCapabilitiesDTO;

export interface ProviderUsage {
  inputTextTokens?: number;
  inputImageTokens?: number;
  outputImageTokens?: number;
  outputTextTokens?: number;
  /** Set only when the provider itself reports a billed amount. */
  confirmedCostUsd?: number;
}

export interface ProviderImage {
  data: Buffer;
  /** Mime type of `data`, e.g. image/png. */
  mimeType: string;
}

export interface ProviderResult {
  images: ProviderImage[];
  usage: ProviderUsage | null;
  /** The provider-side quality value that was actually sent. */
  providerQuality: string;
  model: string;
}

/** Returned by asynchronous providers that hand back a job id instead of images. */
export interface ProviderJob {
  jobId: string;
}

export interface GenerateImageInput {
  prompt: string;
  aspectRatio: AspectRatio;
  quality: QualityLevel;
  count: number;
  negativePrompt?: string;
  signal?: AbortSignal;
}

export interface EditImageInput {
  prompt: string;
  /** The source image(s). The first image is the one being edited. */
  images: ProviderImage[];
  aspectRatio: AspectRatio;
  quality: QualityLevel;
  count: number;
  signal?: AbortSignal;
}

export type JobStatus =
  | { state: "running" }
  | { state: "succeeded"; result: ProviderResult }
  | { state: "failed"; error: string };

export interface ImageGenerationProvider {
  /** Stable id, stored with every generation (e.g. "openai"). */
  readonly id: string;
  readonly displayName: string;
  readonly model: string;
  getSupportedCapabilities(): ProviderCapabilities;
  generateImage(input: GenerateImageInput): Promise<ProviderResult | ProviderJob>;
  editImage?(input: EditImageInput): Promise<ProviderResult | ProviderJob>;
  generateVariations?(input: EditImageInput): Promise<ProviderResult | ProviderJob>;
  getGenerationStatus?(jobId: string): Promise<JobStatus>;
}

export function isProviderJob(value: ProviderResult | ProviderJob): value is ProviderJob {
  return "jobId" in value;
}
