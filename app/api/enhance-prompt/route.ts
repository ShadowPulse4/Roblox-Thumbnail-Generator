import { NextResponse } from "next/server";
import { assertAiAllowed, requireUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { errorResponse, parseJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { getPromptEnhancer } from "@/lib/services";
import { assertWithinSpend } from "@/lib/usage/limits";
import { recordUsage } from "@/lib/usage/records";
import { enhanceRequestSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    assertAiAllowed();
    const user = await requireUser();
    const cfg = getConfig();
    const body = await parseJson(request, enhanceRequestSchema(cfg.maxPromptLength));
    checkRateLimit(`text:${user.id}`, cfg.rateLimitPerMinute * 2, 60_000);
    assertWithinSpend(cfg);

    const enhance = getPromptEnhancer();
    const result = await enhance(
      { prompt: body.prompt, style: body.style, aspectRatio: body.aspectRatio, overlayText: body.overlayText ?? null },
      request.signal,
    );
    recordUsage({
      userId: user.id,
      generationId: null,
      provider: "anthropic",
      model: result.model,
      operation: "text.enhance",
      imageCount: 0,
      usage: { inputTextTokens: result.usage.inputTokens, outputTextTokens: result.usage.outputTokens },
    });

    // Enhanced prompts can be longer than what a user may type; clip to the limit.
    const enhancedPrompt = result.enhancedPrompt.slice(0, cfg.maxPromptLength);
    return NextResponse.json({
      enhancedPrompt,
      suggestedAspectRatio: result.suggestedAspectRatio,
      suggestedStyle: result.suggestedStyle,
      note: result.note,
      model: result.model,
    });
  } catch (err) {
    return errorResponse(err);
  }
}
