import type { Metadata } from "next";
import { CheckCircle2, CircleDashed } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { buildAppStatus } from "@/lib/services";
import { formatUsd } from "@/lib/utils";
import { Badge, Notice, PageHeader, Panel } from "@/components/ui/misc";
import { ChangePassword, UsersAdmin } from "@/components/settings/users-admin";

export const metadata: Metadata = { title: "Instellingen" };

function ServiceRow({
  name,
  role,
  configured,
  detail,
  envVar,
  where,
}: {
  name: string;
  role: string;
  configured: boolean;
  detail: string;
  envVar: string;
  where: string;
}) {
  return (
    <div className="flex gap-3 py-4 first:pt-0 last:pb-0">
      {configured ? (
        <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-label="Ingesteld" />
      ) : (
        <CircleDashed className="mt-0.5 size-5 shrink-0 text-warning" aria-label="Niet ingesteld" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium">{name}</p>
          <Badge tone={configured ? "success" : "warning"}>{configured ? "Ingesteld" : "Ontbreekt"}</Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted">{role}</p>
        <p className="mt-1 text-xs text-subtle">{detail}</p>
        {!configured ? (
          <p className="mt-2 text-xs text-muted">
            Zet <code className="rounded bg-panel-2 px-1 py-0.5 text-fg">{envVar}</code> in <code className="text-fg">.env.local</code> en herstart de app. Sleutel aanmaken: {where}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const cfg = getConfig();
  const status = buildAppStatus(user);
  const caps = status.image.capabilities;

  return (
    <>
      <PageHeader title="Instellingen" subtitle="Welke diensten zijn gekoppeld, welke limieten gelden en wie er toegang heeft." />
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel className="p-5">
          <h2 className="mb-4 text-base font-semibold">Gekoppelde diensten</h2>
          <div className="divide-y divide-line">
            <ServiceRow
              name="OpenAI GPT Image"
              role="Maakt en bewerkt de afbeeldingen."
              configured={status.image.configured}
              detail={`Model: ${status.image.model}${caps ? `. Kwaliteit: ${Object.entries(caps.quality).map(([k, v]) => `${k}=${v}`).join(", ")}. Bewerken: ${caps.edit ? "ja" : "nee"}.` : ""}`}
              envVar="OPENAI_API_KEY"
              where="platform.openai.com, onder API keys. Betaald per gebruik."
            />
            <ServiceRow
              name="Claude (Anthropic API)"
              role="Verbetert je prompts. Maakt zelf geen afbeeldingen."
              configured={status.text.configured}
              detail={`Model: ${status.text.model}. Optioneel: zonder sleutel werkt alles behalve “Prompt verbeteren”.`}
              envVar="ANTHROPIC_API_KEY"
              where="platform.claude.com, onder API keys. Betaald per gebruik."
            />
          </div>
          <Notice className="mt-5" tone="neutral" title="Je Claude-abonnement en de API zijn los van elkaar">
            Een Claude Pro- of Max-abonnement geeft geen API-tegoed. Voor de API laad je apart tegoed op in de Claude Console en betaal je per gebruikte token.
          </Notice>
        </Panel>

        <Panel className="p-5">
          <h2 className="mb-4 text-base font-semibold">Limieten</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <dt className="text-muted">Uitgaven per dag</dt>
            <dd>{cfg.dailySpendLimitUsd === null ? "geen limiet" : `${formatUsd(cfg.dailySpendLimitUsd)} (geschat)`}</dd>
            <dt className="text-muted">Uitgaven per maand</dt>
            <dd>{cfg.monthlySpendLimitUsd === null ? "geen limiet" : `${formatUsd(cfg.monthlySpendLimitUsd)} (geschat)`}</dd>
            <dt className="text-muted">Afbeeldingen per lid per dag</dt>
            <dd>{cfg.dailyImageLimitPerUser ?? "geen limiet"}</dd>
            <dt className="text-muted">Afbeeldingen per verzoek</dt>
            <dd>{cfg.maxImagesPerRequest}</dd>
            <dt className="text-muted">Verzoeken per minuut</dt>
            <dd>{cfg.rateLimitPerMinute}</dd>
            <dt className="text-muted">Maximale promptlengte</dt>
            <dd>{cfg.maxPromptLength} tekens</dd>
          </dl>
          <p className="mt-4 text-xs text-subtle">
            Deze waarden komen uit je omgevingsvariabelen (zie <code className="text-fg">.env.example</code>) en worden op de server gecontroleerd.
          </p>
        </Panel>

        <Panel className="p-5 xl:col-span-2">
          <h2 className="mb-1 text-base font-semibold">Toegang</h2>
          {cfg.authMode === "none" ? (
            <div className="space-y-3 text-sm text-muted">
              <p>
                De app draait nu in <span className="text-fg">lokale modus</span>: geen login, alles hoort bij één lokale gebruiker. Ideaal als alleen jij hem op je eigen computer gebruikt.
              </p>
              <p>
                Wil je vrienden laten meedoen? Zet <code className="rounded bg-panel-2 px-1 py-0.5 text-fg">AUTH_MODE=local</code> in <code className="text-fg">.env.local</code> en herstart. Je maakt dan eerst een beheerdersaccount aan en kunt hier daarna accounts met een eigen daglimiet toevoegen.
              </p>
              {cfg.isProduction ? (
                <Notice tone={cfg.allowOpenAccess ? "warning" : "danger"} title={cfg.allowOpenAccess ? "Open toegang staat aan in productie" : "AI-functies zijn geblokkeerd"}>
                  {cfg.allowOpenAccess
                    ? "Iedereen die deze website kan bereiken, kan je API-tegoed gebruiken. Gebruik dit alleen achter een eigen afscherming."
                    : "Zonder login worden betaalde AI-verzoeken in productie geweigerd. Zet AUTH_MODE=local."}
                </Notice>
              ) : null}
            </div>
          ) : user ? (
            <div className="space-y-6">
              <p className="text-sm text-muted">
                Ingelogd als <span className="text-fg">{user.displayName}</span> (@{user.username}).
              </p>
              <div>
                <h3 className="mb-3 text-sm font-medium">Wachtwoord wijzigen</h3>
                <ChangePassword />
              </div>
              {user.role === "admin" ? (
                <div>
                  <h3 className="mb-3 text-sm font-medium">Accounts</h3>
                  <UsersAdmin currentUserId={user.id} />
                </div>
              ) : null}
            </div>
          ) : null}
        </Panel>
      </div>
    </>
  );
}
