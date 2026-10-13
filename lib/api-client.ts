"use client";

/** Small fetch wrapper for the app's own API. Throws ApiError with the server's Dutch message. */
export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(url, {
      ...rest,
      headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...(rest.headers ?? {}) },
      body: json !== undefined ? JSON.stringify(json) : rest.body,
      cache: "no-store",
    });
  } catch {
    throw new ApiError("network", "Geen verbinding met de server. Controleer of de app nog draait.", 0);
  }
  if (!res.ok) {
    let body: { error?: { code?: string; message?: string; retryAfterSeconds?: number } } = {};
    try {
      body = await res.json();
    } catch {
      /* not json */
    }
    throw new ApiError(
      body.error?.code ?? "http_" + res.status,
      body.error?.message ?? `Verzoek mislukt (${res.status}).`,
      res.status,
      body.error?.retryAfterSeconds,
    );
  }
  return (await res.json()) as T;
}
