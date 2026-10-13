import "server-only";
import path from "node:path";

/**
 * Central, server-only configuration. Every secret is read here and nowhere
 * else, so it is easy to audit that nothing leaks to the browser.
 * Never prefix secrets with NEXT_PUBLIC_.
 */

function str(name: string, fallback = ""): string {
  const value = process.env[name];
  return value === undefined || value.trim() === "" ? fallback : value.trim();
}

function int(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Returns null when unset or "0"/"off", meaning "no limit". */
function optionalNumber(name: string, fallback: number | null): number | null {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fallback;
  const v = raw.trim().toLowerCase();
  if (v === "off" || v === "none" || v === "0") return null;
  const parsed = Number.parseFloat(v);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export type AuthMode = "none" | "local";

export function getConfig() {
  const authMode: AuthMode = str("AUTH_MODE", "none") === "local" ? "local" : "none";
  const isProduction = process.env.NODE_ENV === "production";
  return {
    isProduction,
    authMode,
    /** In production an open (no-login) install refuses AI calls unless explicitly allowed. */
    allowOpenAccess: str("ALLOW_OPEN_ACCESS", "false") === "true",
    /**
     * Send the session cookie only over HTTPS. Defaults to on in production.
     * Set COOKIE_SECURE=false when friends reach the app over plain http on your
     * home network (e.g. http://192.168.1.20:3000).
     */
    cookieSecure: isProduction ? str("COOKIE_SECURE", "true") !== "false" : false,
    dataDir: path.resolve(str("DATA_DIR", "./data")),

    imageProvider: str("IMAGE_PROVIDER", "openai"),
    imageModel: str("IMAGE_MODEL", "gpt-image-2"),
    openaiApiKey: str("OPENAI_API_KEY"),
    imageTimeoutMs: int("IMAGE_TIMEOUT_SECONDS", 240, 30, 900) * 1000,

    anthropicApiKey: str("ANTHROPIC_API_KEY"),
    anthropicModel: str("ANTHROPIC_MODEL", "claude-haiku-5-5"),
    textTimeoutMs: int("TEXT_TIMEOUT_SECONDS", 45, 5, 300) * 1000,

    maxPromptLength: int("MAX_PROMPT_LENGTH", 2000, 50, 32000),
    maxImagesPerRequest: int("MAX_IMAGES_PER_REQUEST", 4, 1, 10),
    rateLimitPerMinute: int("RATE_LIMIT_PER_MINUTE", 6, 1, 600),
    maxUploadBytes: int("MAX_UPLOAD_MB", 10, 1, 50) * 1024 * 1024,

    /** Per-user daily image cap for members. Admins are only bound by spend limits. */
    dailyImageLimitPerUser: optionalNumber("DAILY_IMAGE_LIMIT_PER_USER", 20),
    dailySpendLimitUsd: optionalNumber("DAILY_SPEND_LIMIT_USD", 5),
    monthlySpendLimitUsd: optionalNumber("MONTHLY_SPEND_LIMIT_USD", 30),
  };
}

export type AppConfig = ReturnType<typeof getConfig>;
