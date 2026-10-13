/**
 * Normalised error type for everything that talks to an AI provider.
 * `message` is always safe to show to the user (Dutch, no secrets, no stack).
 */
export type AppErrorCode =
  | "not_configured"
  | "invalid_api_key"
  | "provider_forbidden"
  | "provider_rate_limited"
  | "provider_quota"
  | "provider_unavailable"
  | "provider_timeout"
  | "provider_invalid_response"
  | "content_rejected"
  | "unsupported"
  | "bad_request"
  | "rate_limited"
  | "usage_limit"
  | "spend_limit"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "open_access_blocked"
  | "internal";

const STATUS: Record<AppErrorCode, number> = {
  not_configured: 503,
  invalid_api_key: 502,
  provider_forbidden: 502,
  provider_rate_limited: 429,
  provider_quota: 402,
  provider_unavailable: 502,
  provider_timeout: 504,
  provider_invalid_response: 502,
  content_rejected: 422,
  unsupported: 400,
  bad_request: 400,
  rate_limited: 429,
  usage_limit: 429,
  spend_limit: 429,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  open_access_blocked: 403,
  internal: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly retryAfterSeconds?: number;

  constructor(code: AppErrorCode, message: string, opts?: { retryAfterSeconds?: number; cause?: unknown }) {
    super(message, { cause: opts?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS[code];
    this.retryAfterSeconds = opts?.retryAfterSeconds;
  }
}

/** Duck-typed as well, so it still works when the module is loaded twice (dev reloads). */
export function isAppError(e: unknown): e is AppError {
  if (e instanceof AppError) return true;
  const x = e as Partial<AppError> | null;
  return Boolean(x && x.name === "AppError" && typeof x.code === "string" && typeof x.status === "number");
}

/** Minimal shape shared by the OpenAI and Anthropic SDK error classes. */
interface SdkLikeError {
  name?: string;
  status?: number;
  code?: string | null;
  message?: string;
  error?: { code?: string; type?: string; message?: string } | null;
}

/**
 * Translates an SDK/network error into an AppError with a user-safe message.
 * The raw provider message is never forwarded because it can contain request ids,
 * partial prompts or account details.
 */
export function toProviderError(err: unknown, providerName: string): AppError {
  if (isAppError(err)) return err;
  const e = (err ?? {}) as SdkLikeError;
  // SDK error classes keep name "Error", so look at the class name as well.
  const ctor = (err as { constructor?: { name?: string } } | null)?.constructor?.name ?? "";
  const name = `${e.name ?? ""} ${ctor}`;
  const code = (e.code ?? e.error?.code ?? e.error?.type ?? "") as string;

  if (name.includes("Abort") || name.includes("Timeout") || code === "ETIMEDOUT") {
    return new AppError("provider_timeout", `${providerName} reageerde niet op tijd. Probeer het opnieuw.`, { cause: err });
  }
  if (name.includes("Connection")) {
    return new AppError("provider_unavailable", `Kan ${providerName} niet bereiken. Controleer je internetverbinding.`, { cause: err });
  }
  switch (e.status) {
    case 400:
      if (code.includes("moderation") || code.includes("content_policy") || code.includes("safety")) {
        return new AppError("content_rejected", `${providerName} heeft deze prompt geweigerd door het inhoudsbeleid. Pas de prompt aan en probeer het opnieuw.`, { cause: err });
      }
      return new AppError("bad_request", `${providerName} accepteerde het verzoek niet. Controleer de instellingen (model, formaat) en probeer het opnieuw.`, { cause: err });
    case 401:
      return new AppError("invalid_api_key", `De API-sleutel voor ${providerName} is ongeldig of verlopen.`, { cause: err });
    case 403:
      return new AppError("provider_forbidden", `${providerName} weigert toegang tot dit model. Mogelijk moet je organisatie eerst geverifieerd worden.`, { cause: err });
    case 404:
      return new AppError("bad_request", `Het ingestelde model bestaat niet bij ${providerName}. Controleer de modelnaam in je .env-bestand.`, { cause: err });
    case 429:
      if (code.includes("quota") || code.includes("billing")) {
        return new AppError("provider_quota", `Je tegoed bij ${providerName} is op of je bestedingslimiet is bereikt.`, { cause: err });
      }
      return new AppError("provider_rate_limited", `${providerName} krijgt te veel verzoeken. Wacht even en probeer het opnieuw.`, { retryAfterSeconds: 30, cause: err });
    default:
      if (typeof e.status === "number" && e.status >= 500) {
        return new AppError("provider_unavailable", `${providerName} heeft een storing. Probeer het later opnieuw.`, { cause: err });
      }
  }
  // Log only the shape of the error server-side; provider messages can contain account details.
  console.warn(`[${providerName}] unmapped provider error`, { name, status: e.status, code });
  return new AppError("internal", `Er ging iets mis bij ${providerName}.`, { cause: err });
}
