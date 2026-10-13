import "server-only";
import OpenAI, { toFile } from "openai";
import type {
  EditImageInput,
  GenerateImageInput,
  ImageGenerationProvider,
  ProviderResult,
  ProviderUsage,
} from "@/types/provider";
import { AppError, toProviderError } from "../errors";
import { getOpenAIModelInfo, getSizePlan, openAICapabilities } from "../models";

type ImagesClient = Pick<OpenAI, "images">;

interface Options {
  apiKey: string;
  model: string;
  timeoutMs: number;
  maxImagesPerRequest: number;
  /** Injected in tests. */
  client?: ImagesClient;
}

interface RawImagesResponse {
  data?: { b64_json?: string | null }[] | null;
  output_format?: string | null;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    input_tokens_details?: { image_tokens?: number; text_tokens?: number };
    output_tokens_details?: { image_tokens?: number; text_tokens?: number };
  } | null;
}

const MIME: Record<string, string> = { png: "image/png", jpeg: "image/jpeg", webp: "image/webp" };

export function createOpenAIImageProvider(opts: Options): ImageGenerationProvider {
  const client: ImagesClient =
    opts.client ??
    new OpenAI({
      apiKey: opts.apiKey,
      timeout: opts.timeoutMs,
      // One retry for transient network errors; rate limits are surfaced to the user.
      maxRetries: 1,
    });
  const info = getOpenAIModelInfo(opts.model);
  const name = "OpenAI";

  function qualityFor(level: GenerateImageInput["quality"]): string {
    const q = info.quality[level];
    if (!q) {
      throw new AppError("unsupported", `Het model ${opts.model} ondersteunt de kwaliteit "${level}" niet.`);
    }
    return q;
  }

  function clampCount(count: number): number {
    const max = Math.min(opts.maxImagesPerRequest, 10);
    if (count < 1 || count > max) {
      throw new AppError("bad_request", `Je kunt 1 tot ${max} afbeeldingen per keer maken.`);
    }
    return count;
  }

  function parse(res: RawImagesResponse, providerQuality: string): ProviderResult {
    const format = res.output_format ?? "png";
    const images = (res.data ?? [])
      .map((d) => d.b64_json)
      .filter((b): b is string => typeof b === "string" && b.length > 0)
      .map((b64) => ({ data: Buffer.from(b64, "base64"), mimeType: MIME[format] ?? "image/png" }));
    if (images.length === 0) {
      throw new AppError("provider_invalid_response", "OpenAI gaf geen afbeelding terug. Probeer het opnieuw.");
    }
    let usage: ProviderUsage | null = null;
    if (res.usage) {
      const inDetails = res.usage.input_tokens_details;
      const outDetails = res.usage.output_tokens_details;
      usage = {
        inputTextTokens: inDetails?.text_tokens ?? (inDetails ? 0 : res.usage.input_tokens),
        inputImageTokens: inDetails?.image_tokens ?? 0,
        outputImageTokens: outDetails?.image_tokens ?? res.usage.output_tokens,
        outputTextTokens: outDetails?.text_tokens ?? 0,
      };
    }
    return { images, usage, providerQuality, model: opts.model };
  }

  async function runEdit(input: EditImageInput): Promise<ProviderResult> {
    if (input.images.length === 0) {
      throw new AppError("bad_request", "Er is geen bronafbeelding om te bewerken.");
    }
    const quality = qualityFor(input.quality);
    const n = clampCount(input.count);
    const plan = getSizePlan(opts.model, input.aspectRatio);
    try {
      const files = await Promise.all(
        input.images.map((img, i) =>
          toFile(img.data, `source-${i}.${img.mimeType.split("/")[1] ?? "png"}`, { type: img.mimeType }),
        ),
      );
      const res = (await client.images.edit(
        {
          model: opts.model,
          prompt: input.prompt,
          image: files,
          n,
          size: `${plan.request.width}x${plan.request.height}`,
          quality: quality as "medium",
          output_format: "png",
          ...(info.supportsInputFidelity ? { input_fidelity: "high" as const } : {}),
        },
        { signal: input.signal },
      )) as unknown as RawImagesResponse;
      return parse(res, quality);
    } catch (err) {
      throw toProviderError(err, name);
    }
  }

  return {
    id: "openai",
    displayName: "OpenAI GPT Image",
    model: opts.model,

    getSupportedCapabilities() {
      return openAICapabilities(opts.model, opts.maxImagesPerRequest);
    },

    async generateImage(input) {
      const quality = qualityFor(input.quality);
      const n = clampCount(input.count);
      const plan = getSizePlan(opts.model, input.aspectRatio);
      try {
        const res = (await client.images.generate(
          {
            model: opts.model,
            prompt: input.prompt,
            n,
            size: `${plan.request.width}x${plan.request.height}`,
            quality: quality as "medium",
            output_format: "png",
          },
          { signal: input.signal },
        )) as unknown as RawImagesResponse;
        return parse(res, quality);
      } catch (err) {
        throw toProviderError(err, name);
      }
    },

    editImage: runEdit,

    generateVariations: runEdit,
  };
}
