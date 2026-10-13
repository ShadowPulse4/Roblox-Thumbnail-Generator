import { AppError } from "@/lib/ai/errors";

/**
 * In-memory sliding-window rate limiter. Good enough for a single Node
 * process (this app's deployment model). If you ever run several instances,
 * swap this for a shared store such as Redis.
 */
type GlobalWithBuckets = typeof globalThis & { __nuggetRate?: Map<string, number[]> };

function buckets(): Map<string, number[]> {
  const g = globalThis as GlobalWithBuckets;
  g.__nuggetRate ??= new Map();
  return g.__nuggetRate;
}

export function checkRateLimit(key: string, limit: number, windowMs: number, now = Date.now()): void {
  const map = buckets();
  const hits = (map.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((windowMs - (now - hits[0])) / 1000));
    map.set(key, hits);
    throw new AppError(
      "rate_limited",
      `Je doet te veel verzoeken achter elkaar. Probeer het over ${retryAfterSeconds} seconden opnieuw.`,
      { retryAfterSeconds },
    );
  }
  hits.push(now);
  map.set(key, hits);
}

export function resetRateLimits() {
  buckets().clear();
}
