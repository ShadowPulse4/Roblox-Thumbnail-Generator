import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { AppError, isAppError } from "@/lib/ai/errors";

export interface ApiErrorBody {
  error: { code: string; message: string; retryAfterSeconds?: number };
}

export function errorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (isAppError(err)) {
    const headers: Record<string, string> = {};
    if (err.retryAfterSeconds) headers["Retry-After"] = String(err.retryAfterSeconds);
    return NextResponse.json(
      { error: { code: err.code, message: err.message, retryAfterSeconds: err.retryAfterSeconds } },
      { status: err.status, headers },
    );
  }
  // Unknown errors are logged server-side only; the client gets a generic message.
  console.error("[api] unexpected error", err);
  return NextResponse.json(
    { error: { code: "internal", message: "Er ging iets mis op de server. Probeer het opnieuw." } },
    { status: 500 },
  );
}

/**
 * Rejects cross-site mutating requests: the Origin header (sent by browsers on
 * POST/PATCH/DELETE) must match the Host the request was sent to.
 */
export function assertSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    if (new URL(origin).host !== host) throw new Error("mismatch");
  } catch {
    throw new AppError("forbidden", "Verzoek van een andere website geweigerd.");
  }
}

export async function parseJson<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  assertSameOrigin(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new AppError("bad_request", "Ongeldig verzoek.");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new AppError("bad_request", first?.message || "Ongeldige invoer.");
  }
  return parsed.data;
}
