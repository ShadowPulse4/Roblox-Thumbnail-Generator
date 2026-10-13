import "server-only";
import { AppError } from "@/lib/ai/errors";
import type { AppConfig } from "@/lib/config";
import { countActiveGenerations, countImagesSince, type UserRecord } from "@/lib/database/repo";
import { spendSince, startOfMonth, startOfToday } from "./records";

export const MAX_PARALLEL_GENERATIONS = 2;

/** The effective daily image cap for a user, or null for "no image cap". */
export function dailyImageLimitFor(user: UserRecord, cfg: AppConfig): number | null {
  if (user.dailyImageLimit !== null && user.dailyImageLimit !== undefined) return user.dailyImageLimit;
  return user.role === "member" ? cfg.dailyImageLimitPerUser : null;
}

/**
 * Server-side guard run before every paid AI call. All numbers come from the
 * database and config, never from the request body.
 */
export function assertCanGenerate(user: UserRecord, requestedImages: number, cfg: AppConfig) {
  if (requestedImages > cfg.maxImagesPerRequest) {
    throw new AppError("bad_request", `Maximaal ${cfg.maxImagesPerRequest} afbeeldingen per keer.`);
  }

  if (countActiveGenerations(user.id) >= MAX_PARALLEL_GENERATIONS) {
    throw new AppError(
      "rate_limited",
      `Je hebt al ${MAX_PARALLEL_GENERATIONS} generaties lopen. Wacht tot er een klaar is.`,
      { retryAfterSeconds: 20 },
    );
  }

  const limit = dailyImageLimitFor(user, cfg);
  if (limit !== null) {
    const used = countImagesSince(user.id, startOfToday().toISOString());
    if (used + requestedImages > limit) {
      const left = Math.max(0, limit - used);
      throw new AppError(
        "usage_limit",
        left === 0
          ? `Je daglimiet van ${limit} afbeeldingen is bereikt. Morgen kun je weer verder.`
          : `Je kunt vandaag nog ${left} ${left === 1 ? "afbeelding" : "afbeeldingen"} maken (limiet ${limit}).`,
      );
    }
  }

  assertWithinSpend(cfg);
}

export function assertWithinSpend(cfg: AppConfig) {
  if (cfg.dailySpendLimitUsd !== null && spendSince(startOfToday()) >= cfg.dailySpendLimitUsd) {
    throw new AppError(
      "spend_limit",
      `De dagelijkse uitgavenlimiet van $${cfg.dailySpendLimitUsd.toFixed(2)} (geschat) is bereikt. Pas DAILY_SPEND_LIMIT_USD aan of wacht tot morgen.`,
    );
  }
  if (cfg.monthlySpendLimitUsd !== null && spendSince(startOfMonth()) >= cfg.monthlySpendLimitUsd) {
    throw new AppError(
      "spend_limit",
      `De maandelijkse uitgavenlimiet van $${cfg.monthlySpendLimitUsd.toFixed(2)} (geschat) is bereikt.`,
    );
  }
}
