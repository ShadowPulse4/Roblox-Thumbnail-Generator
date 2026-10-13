import "server-only";
import { randomUUID } from "node:crypto";
import type { UsageRecordDTO, UsageSummaryDTO, UsageTotals } from "@/types/generation";
import type { ProviderUsage } from "@/types/provider";
import { getDb, nowIso } from "@/lib/database/db";
import { getConfig } from "@/lib/config";
import { estimateCost } from "./pricing";

export type UsageOperation = "image.generate" | "image.edit" | "image.variation" | "text.enhance";

export function recordUsage(input: {
  userId: string | null;
  generationId: string | null;
  provider: string;
  model: string;
  operation: UsageOperation;
  imageCount: number;
  usage: ProviderUsage | null;
  metadata?: Record<string, unknown>;
}) {
  const cost = estimateCost(input.model, input.usage);
  const inputTokens = input.usage
    ? (input.usage.inputTextTokens ?? 0) + (input.usage.inputImageTokens ?? 0)
    : null;
  const outputTokens = input.usage
    ? (input.usage.outputImageTokens ?? 0) + (input.usage.outputTextTokens ?? 0)
    : null;
  getDb()
    .prepare(
      `INSERT INTO usage_records (id, user_id, generation_id, provider, model, operation, image_count, input_tokens, output_tokens, estimated_cost_usd, actual_cost_usd, cost_status, metadata_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      randomUUID(),
      input.userId,
      input.generationId,
      input.provider,
      input.model,
      input.operation,
      input.imageCount,
      inputTokens,
      outputTokens,
      cost.status === "estimated" ? cost.usd : null,
      cost.status === "confirmed" ? cost.usd : null,
      cost.status,
      JSON.stringify({ ...(input.metadata ?? {}), usage: input.usage }),
      nowIso(),
    );
}

/** Day and month boundaries in the server's local time zone. */
export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
export function startOfMonth(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function totals(sinceIso: string, userId: string | null): UsageTotals {
  const r = getDb()
    .prepare(
      `SELECT IFNULL(SUM(image_count),0) AS images, COUNT(*) AS requests,
              IFNULL(SUM(estimated_cost_usd),0) AS est, IFNULL(SUM(actual_cost_usd),0) AS conf,
              SUM(CASE WHEN cost_status = 'unknown' THEN 1 ELSE 0 END) AS unknown
       FROM usage_records WHERE created_at >= ? ${userId ? "AND user_id = ?" : ""}`,
    )
    .get(...(userId ? [sinceIso, userId] : [sinceIso])) as {
    images: number;
    requests: number;
    est: number;
    conf: number;
    unknown: number | null;
  };
  return {
    images: r.images,
    requests: r.requests,
    estimatedUsd: r.est,
    confirmedUsd: r.conf,
    unknownCostRequests: r.unknown ?? 0,
  };
}

/** Total spend (estimated + confirmed) across all users, used for global spend limits. */
export function spendSince(since: Date): number {
  const t = totals(since.toISOString(), null);
  return t.estimatedUsd + t.confirmedUsd;
}

export function getUsageSummary(opts: { userId: string; all: boolean }): UsageSummaryDTO {
  const cfg = getConfig();
  const scopeUser = opts.all ? null : opts.userId;
  const db = getDb();
  const monthStart = startOfMonth();

  const dayRows = db
    .prepare(
      `SELECT created_at, image_count, IFNULL(estimated_cost_usd,0) + IFNULL(actual_cost_usd,0) AS usd FROM usage_records
       WHERE created_at >= ? ${scopeUser ? "AND user_id = ?" : ""}`,
    )
    .all(...(scopeUser ? [monthStart.toISOString(), scopeUser] : [monthStart.toISOString()])) as {
    created_at: string;
    image_count: number;
    usd: number;
  }[];

  const byDayMap = new Map<string, { images: number; estimatedUsd: number }>();
  const today = startOfToday();
  for (let d = new Date(monthStart); d <= today; d.setDate(d.getDate() + 1)) {
    byDayMap.set(localDay(d), { images: 0, estimatedUsd: 0 });
  }
  for (const r of dayRows) {
    const key = localDay(new Date(r.created_at));
    const entry = byDayMap.get(key) ?? { images: 0, estimatedUsd: 0 };
    entry.images += r.image_count;
    entry.estimatedUsd += r.usd;
    byDayMap.set(key, entry);
  }

  const recentRows = db
    .prepare(
      `SELECT r.*, u.username FROM usage_records r LEFT JOIN users u ON u.id = r.user_id
       ${scopeUser ? "WHERE r.user_id = ?" : ""} ORDER BY r.created_at DESC LIMIT 25`,
    )
    .all(...(scopeUser ? [scopeUser] : [])) as {
    id: string;
    created_at: string;
    username: string | null;
    provider: string;
    model: string;
    operation: string;
    image_count: number;
    input_tokens: number | null;
    output_tokens: number | null;
    estimated_cost_usd: number | null;
    actual_cost_usd: number | null;
    cost_status: "estimated" | "confirmed" | "unknown";
  }[];

  const recent: UsageRecordDTO[] = recentRows.map((r) => ({
    id: r.id,
    createdAt: r.created_at,
    username: r.username,
    provider: r.provider,
    model: r.model,
    operation: r.operation,
    imageCount: r.image_count,
    inputTokens: r.input_tokens,
    outputTokens: r.output_tokens,
    costUsd: r.actual_cost_usd ?? r.estimated_cost_usd,
    costStatus: r.cost_status,
  }));

  return {
    today: totals(today.toISOString(), scopeUser),
    month: totals(monthStart.toISOString(), scopeUser),
    limits: {
      dailySpendUsd: cfg.dailySpendLimitUsd,
      monthlySpendUsd: cfg.monthlySpendLimitUsd,
      dailyImagesPerUser: cfg.dailyImageLimitPerUser,
    },
    byDay: [...byDayMap.entries()].map(([day, v]) => ({ day, images: v.images, estimatedUsd: v.estimatedUsd })),
    recent,
    scope: opts.all ? "all" : "self",
  };
}

function localDay(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}
