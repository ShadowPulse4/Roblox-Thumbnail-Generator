import { beforeEach, describe, expect, it, vi } from "vitest";
import { getConfig } from "@/lib/config";
import { selectImageProvider } from "@/lib/ai/providers";
import { createOpenAIImageProvider } from "@/lib/ai/providers/openai";
import { openAICapabilities } from "@/lib/ai/models";
import { AppError, toProviderError } from "@/lib/ai/errors";
import { createPromptEnhancer } from "@/lib/ai/enhancer";
import { estimateCost } from "@/lib/usage/pricing";
import { getImageProvider, getPromptEnhancer } from "@/lib/services";
import { setupTestEnv } from "./helpers/env";

beforeEach(() => {
  setupTestEnv();
});

describe("provider selection", () => {
  it("reports a missing OpenAI key instead of pretending to work", () => {
    const sel = selectImageProvider(getConfig());
    expect(sel.ok).toBe(false);
    if (!sel.ok) {
      expect(sel.reason).toBe("missing_key");
      expect(sel.message).toContain("OPENAI_API_KEY");
    }
    expect(() => getImageProvider()).toThrowError(AppError);
  });

  it("rejects an unknown provider", () => {
    process.env.IMAGE_PROVIDER = "dalle-magic";
    process.env.OPENAI_API_KEY = "sk-test";
    const sel = selectImageProvider(getConfig());
    expect(sel.ok).toBe(false);
    if (!sel.ok) expect(sel.reason).toBe("unknown_provider");
  });

  it("selects OpenAI with the configured model", () => {
    process.env.OPENAI_API_KEY = "sk-test";
    process.env.IMAGE_MODEL = "gpt-image-2";
    const sel = selectImageProvider(getConfig());
    expect(sel.ok && sel.provider.model).toBe("gpt-image-2");
  });

  it("explains that prompt enhancement needs an Anthropic key", () => {
    try {
      getPromptEnhancer();
      expect.unreachable();
    } catch (e) {
      expect((e as AppError).code).toBe("not_configured");
      expect((e as AppError).message).toContain("ANTHROPIC_API_KEY");
    }
  });
});

describe("model capabilities", () => {
  it("gpt-image-2 offers standard and high, not ultra", () => {
    const caps = openAICapabilities("gpt-image-2", 4);
    expect(caps.quality).toEqual({ standard: "medium", high: "high" });
    expect(caps.aspectRatios["16:9"]).toEqual({ width: 1920, height: 1080, cropped: true });
    expect(caps.aspectRatios["1:1"]?.cropped).toBe(false);
  });

  it("the gpt-image-2.5 family adds ultra", () => {
    expect(openAICapabilities("gpt-image-2.5-flare", 4).quality.ultra).toBe("xhigh");
  });

  it("older fixed-size models crop to the requested ratio", () => {
    const caps = openAICapabilities("gpt-image-1", 4);
    expect(caps.aspectRatios["16:9"]).toEqual({ width: 1536, height: 864, cropped: true });
    expect(caps.aspectRatios["9:16"]).toEqual({ width: 864, height: 1536, cropped: true });
  });
});

function fakeImagesClient(response: unknown) {
  return {
    images: {
      generate: vi.fn().mockResolvedValue(response),
      edit: vi.fn().mockResolvedValue(response),
    },
  };
}

const PNG_B64 = Buffer.from("png-bytes").toString("base64");

describe("OpenAI image provider", () => {
  it("sends the right size and quality and parses images and usage", async () => {
    const client = fakeImagesClient({
      data: [{ b64_json: PNG_B64 }, { b64_json: PNG_B64 }],
      output_format: "png",
      usage: { input_tokens: 50, output_tokens: 5000, input_tokens_details: { text_tokens: 50, image_tokens: 0 } },
    });
    const provider = createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-2", timeoutMs: 1000, maxImagesPerRequest: 4, client: client as never });
    const res = await provider.generateImage({ prompt: "p", aspectRatio: "9:16", quality: "high", count: 2 });
    expect(client.images.generate).toHaveBeenCalledWith(
      expect.objectContaining({ model: "gpt-image-2", size: "1088x1920", quality: "high", n: 2, output_format: "png" }),
      expect.anything(),
    );
    if ("jobId" in res) throw new Error("unexpected job");
    expect(res.images).toHaveLength(2);
    expect(res.images[0].data.toString()).toBe("png-bytes");
    expect(res.usage).toMatchObject({ inputTextTokens: 50, outputImageTokens: 5000 });
  });

  it("refuses a quality the model does not support", async () => {
    const provider = createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-2", timeoutMs: 1000, maxImagesPerRequest: 4, client: fakeImagesClient({}) as never });
    await expect(provider.generateImage({ prompt: "p", aspectRatio: "1:1", quality: "ultra", count: 1 })).rejects.toMatchObject({ code: "unsupported" });
  });

  it("enforces the per-request image limit", async () => {
    const provider = createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-2", timeoutMs: 1000, maxImagesPerRequest: 2, client: fakeImagesClient({}) as never });
    await expect(provider.generateImage({ prompt: "p", aspectRatio: "1:1", quality: "standard", count: 4 })).rejects.toMatchObject({ code: "bad_request" });
  });

  it("treats an empty response as invalid instead of succeeding", async () => {
    const provider = createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-2", timeoutMs: 1000, maxImagesPerRequest: 4, client: fakeImagesClient({ data: [] }) as never });
    await expect(provider.generateImage({ prompt: "p", aspectRatio: "1:1", quality: "standard", count: 1 })).rejects.toMatchObject({ code: "provider_invalid_response" });
  });

  it("only sends input_fidelity to models that accept it", async () => {
    const response = { data: [{ b64_json: PNG_B64 }] };
    const img = { data: Buffer.from("x"), mimeType: "image/png" };
    const c1 = fakeImagesClient(response);
    await createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-1", timeoutMs: 1000, maxImagesPerRequest: 4, client: c1 as never })
      .editImage!({ prompt: "p", images: [img], aspectRatio: "1:1", quality: "standard", count: 1 });
    expect(c1.images.edit.mock.calls[0][0]).toHaveProperty("input_fidelity", "high");

    const c2 = fakeImagesClient(response);
    await createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-2", timeoutMs: 1000, maxImagesPerRequest: 4, client: c2 as never })
      .editImage!({ prompt: "p", images: [img], aspectRatio: "1:1", quality: "standard", count: 1 });
    expect(c2.images.edit.mock.calls[0][0]).not.toHaveProperty("input_fidelity");
  });

  it("maps SDK errors to safe app errors", async () => {
    const client = { images: { generate: vi.fn().mockRejectedValue(Object.assign(new Error("Incorrect API key sk-abc123"), { status: 401 })) } };
    const provider = createOpenAIImageProvider({ apiKey: "x", model: "gpt-image-2", timeoutMs: 1000, maxImagesPerRequest: 4, client: client as never });
    const err = await provider.generateImage({ prompt: "p", aspectRatio: "1:1", quality: "standard", count: 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.code).toBe("invalid_api_key");
    // The raw provider message (which can contain key fragments) is never passed on.
    expect(err.message).not.toContain("sk-abc123");
  });
});

describe("error mapping", () => {
  it.each([
    [{ status: 429, code: "insufficient_quota" }, "provider_quota"],
    [{ status: 429, code: "rate_limit_exceeded" }, "provider_rate_limited"],
    [{ status: 400, code: "moderation_blocked" }, "content_rejected"],
    [{ status: 403 }, "provider_forbidden"],
    [{ status: 503 }, "provider_unavailable"],
    [{ name: "APIConnectionTimeoutError" }, "provider_timeout"],
    [{ name: "APIConnectionError" }, "provider_unavailable"],
    [{ name: "AbortError" }, "provider_timeout"],
  ])("%o -> %s", (raw, code) => {
    expect(toProviderError(Object.assign(new Error("raw"), raw), "OpenAI").code).toBe(code);
  });
});

it("recognises SDK error classes by class name", () => {
  class APIConnectionError extends Error {}
  class APIConnectionTimeoutError extends Error {}
  expect(toProviderError(new APIConnectionError("Connection error."), "OpenAI").code).toBe("provider_unavailable");
  expect(toProviderError(new APIConnectionTimeoutError("timeout"), "OpenAI").code).toBe("provider_timeout");
});

describe("prompt enhancement (Claude)", () => {
  function fakeAnthropic(content: unknown[]) {
    return {
      messages: {
        create: vi.fn().mockResolvedValue({ content, usage: { input_tokens: 300, output_tokens: 120 }, model: "claude-haiku-5-5" }),
      },
    };
  }

  it("returns the rewritten prompt and drops suggestions equal to the current choice", async () => {
    const client = fakeAnthropic([
      {
        type: "tool_use",
        name: "submit_thumbnail_prompt",
        input: { enhanced_prompt: "A towering lava dragon roars over a golden nugget king...", suggested_aspect_ratio: "16:9", suggested_style: "anime", note: "Ik heb de belichting uitgewerkt." },
      },
    ]);
    const enhance = createPromptEnhancer({ apiKey: "x", model: "claude-haiku-5-5", timeoutMs: 1000, client: client as never });
    const res = await enhance({ prompt: "nugget king vs dragon", style: "boss-fight", aspectRatio: "16:9", overlayText: "EPIC BOSS!" });
    expect(res.enhancedPrompt).toContain("lava dragon");
    expect(res.suggestedAspectRatio).toBeNull(); // same as current
    expect(res.suggestedStyle).toBe("anime");
    expect(res.usage).toEqual({ inputTokens: 300, outputTokens: 120 });
    const sent = client.messages.create.mock.calls[0][0];
    expect(sent.tool_choice).toEqual({ type: "tool", name: "submit_thumbnail_prompt" });
    expect(sent.messages[0].content).toContain("EPIC BOSS!");
  });

  it("fails clearly when Claude returns no usable tool call", async () => {
    const enhance = createPromptEnhancer({ apiKey: "x", model: "m", timeoutMs: 1000, client: fakeAnthropic([{ type: "text", text: "hi" }]) as never });
    await expect(enhance({ prompt: "idea", style: "custom", aspectRatio: "1:1" })).rejects.toMatchObject({ code: "provider_invalid_response" });
  });
});

describe("cost estimates", () => {
  it("estimates from tokens and labels the result as estimated", () => {
    const c = estimateCost("gpt-image-2", { inputTextTokens: 1_000_000, outputImageTokens: 1_000_000 });
    expect(c.status).toBe("estimated");
    expect(c.usd).toBeCloseTo(17.5);
  });

  it("uses the base price for dated snapshots", () => {
    expect(estimateCost("gpt-image-2.5-flare-2026-09-08", { outputImageTokens: 1_000_000 }).usd).toBeCloseTo(30);
  });

  it("marks unknown models and missing usage as unknown rather than guessing", () => {
    expect(estimateCost("some-new-model", { outputImageTokens: 10 })).toEqual({ usd: null, status: "unknown" });
    expect(estimateCost("gpt-image-2", null)).toEqual({ usd: null, status: "unknown" });
  });

  it("prefers a provider-confirmed cost", () => {
    expect(estimateCost("gpt-image-2", { confirmedCostUsd: 0.12 })).toEqual({ usd: 0.12, status: "confirmed" });
  });
});
