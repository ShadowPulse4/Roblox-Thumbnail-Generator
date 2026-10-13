"use client";

import * as React from "react";
import { AlertTriangle, Info } from "lucide-react";
import type { UsageSummaryDTO, UsageTotals } from "@/types/generation";
import { api, ApiError } from "@/lib/api-client";
import { cn, formatDateTime, formatUsd } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Notice, Panel, Skeleton } from "@/components/ui/misc";

const OPERATION_LABELS: Record<string, string> = {
  "image.generate": "Genereren",
  "image.edit": "Bewerken",
  "image.variation": "Variaties",
  "text.enhance": "Prompt verbeteren",
};

function LimitBar({ label, used, limit }: { label: string; used: number; limit: number | null }) {
  if (limit === null) {
    return (
      <div className="text-xs text-subtle">
        {label}: geen limiet ingesteld
      </div>
    );
  }
  const pct = Math.min(100, (used / limit) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs">
        <span className="text-muted">{label}</span>
        <span className="tabular-nums text-fg">
          {formatUsd(used)} <span className="text-subtle">van {formatUsd(limit)}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : pct > 80 ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TotalsCard({ title, totals, limit }: { title: string; totals: UsageTotals; limit: number | null }) {
  const spend = totals.estimatedUsd + totals.confirmedUsd;
  return (
    <Panel className="p-5">
      <h2 className="text-sm font-medium text-muted">{title}</h2>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-[family-name:var(--font-display)] text-4xl font-semibold tabular-nums">{totals.images}</span>
        <span className="text-sm text-muted">{totals.images === 1 ? "afbeelding" : "afbeeldingen"}</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-subtle">Geschatte kosten</dt>
          <dd className="mt-0.5 tabular-nums">{formatUsd(totals.estimatedUsd, 3)}</dd>
        </div>
        <div>
          <dt className="text-xs text-subtle">Verzoeken</dt>
          <dd className="mt-0.5 tabular-nums">{totals.requests}</dd>
        </div>
        {totals.confirmedUsd > 0 ? (
          <div>
            <dt className="text-xs text-subtle">Bevestigd door provider</dt>
            <dd className="mt-0.5 tabular-nums">{formatUsd(totals.confirmedUsd, 3)}</dd>
          </div>
        ) : null}
        {totals.unknownCostRequests > 0 ? (
          <div>
            <dt className="text-xs text-subtle">Kosten onbekend</dt>
            <dd className="mt-0.5 tabular-nums">{totals.unknownCostRequests} verzoeken</dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-4 border-t border-line pt-4">
        <LimitBar label="Uitgavenlimiet" used={spend} limit={limit} />
      </div>
    </Panel>
  );
}

function DailyChart({ days }: { days: UsageSummaryDTO["byDay"] }) {
  const peak = Math.max(0, ...days.map((d) => d.images));
  const max = Math.max(1, peak);
  return (
    <Panel className="p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-medium text-muted">Afbeeldingen per dag, deze maand</h2>
        <span className="text-xs text-subtle">Hoogste dag: {peak}</span>
      </div>
      <div className="mt-5 flex h-36 items-end gap-[3px]" role="img" aria-label={`Staafdiagram met afbeeldingen per dag. Hoogste dag: ${peak}.`}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end">
            <div
              className={cn("w-full rounded-t-[3px]", d.images > 0 ? "bg-accent/80 group-hover:bg-accent" : "bg-line")}
              style={{ height: d.images > 0 ? `${Math.max(4, (d.images / max) * 100)}%` : "2px" }}
              title={`${d.day}: ${d.images} afbeeldingen, ${formatUsd(d.estimatedUsd, 3)} geschat`}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-subtle">
        <span>{days[0]?.day.slice(8)}</span>
        <span>{days.at(-1)?.day.slice(8)}</span>
      </div>
    </Panel>
  );
}

export function UsageDashboard() {
  const [data, setData] = React.useState<UsageSummaryDTO | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const [attempt, setAttempt] = React.useState(0);

  React.useEffect(() => {
    let alive = true;
    api<UsageSummaryDTO>("/api/usage")
      .then((d) => {
        if (!alive) return;
        setData(d);
        setError(null);
      })
      .catch((e) => alive && setError(e instanceof ApiError ? e.message : "Laden is mislukt."));
    return () => {
      alive = false;
    };
  }, [attempt]);

  const load = () => {
    setError(null);
    setData(null);
    setAttempt((a) => a + 1);
  };

  if (error) {
    return <EmptyState icon={<AlertTriangle />} title="Gebruik kon niet geladen worden" action={<Button onClick={load}>Opnieuw proberen</Button>}>{error}</EmptyState>;
  }
  if (!data) {
    return (
      <div className="grid gap-4 lg:grid-cols-2" aria-busy="true" aria-label="Gebruik laden">
        <Skeleton className="h-60" />
        <Skeleton className="h-60" />
        <Skeleton className="h-52 lg:col-span-2" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Notice tone="neutral" icon={<Info className="text-muted" />} title="Alle bedragen zijn schattingen">
        OpenAI en Anthropic geven per verzoek geen gefactureerd bedrag terug. De app rekent met de gebruikte tokens en de prijstabel in <code className="text-fg">lib/usage/pricing.ts</code>. Je echte rekening staat in je OpenAI- en Anthropic-dashboard.
        {data.scope === "all" ? " Als beheerder zie je het gebruik van iedereen." : ""}
      </Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        <TotalsCard title="Vandaag" totals={data.today} limit={data.limits.dailySpendUsd} />
        <TotalsCard title="Deze maand" totals={data.month} limit={data.limits.monthlySpendUsd} />
      </div>
      <DailyChart days={data.byDay} />
      <Panel className="overflow-hidden">
        <h2 className="border-b border-line px-5 py-4 text-sm font-medium text-muted">Laatste verzoeken</h2>
        {data.recent.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-muted">Nog geen verzoeken. Zodra je iets genereert, zie je het hier.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs text-subtle">
                <tr>
                  <th scope="col" className="px-5 py-2.5 font-medium">Tijd</th>
                  {data.scope === "all" ? <th scope="col" className="px-3 py-2.5 font-medium">Gebruiker</th> : null}
                  <th scope="col" className="px-3 py-2.5 font-medium">Actie</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Model</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Afb.</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Tokens in/uit</th>
                  <th scope="col" className="px-5 py-2.5 text-right font-medium">Kosten</th>
                </tr>
              </thead>
              <tbody>
                {data.recent.map((r) => (
                  <tr key={r.id} className="border-t border-line">
                    <td className="whitespace-nowrap px-5 py-2.5 text-muted">{formatDateTime(r.createdAt)}</td>
                    {data.scope === "all" ? <td className="px-3 py-2.5 text-muted">{r.username ?? "verwijderd"}</td> : null}
                    <td className="px-3 py-2.5">{OPERATION_LABELS[r.operation] ?? r.operation}</td>
                    <td className="px-3 py-2.5 text-muted">{r.model}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{r.imageCount || "–"}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-muted">
                      {r.inputTokens ?? "?"} / {r.outputTokens ?? "?"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-right tabular-nums">
                      {formatUsd(r.costUsd, 4)}{" "}
                      <Badge tone={r.costStatus === "confirmed" ? "success" : r.costStatus === "unknown" ? "warning" : "neutral"} className="ml-1">
                        {r.costStatus === "confirmed" ? "bevestigd" : r.costStatus === "unknown" ? "onbekend" : "geschat"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
