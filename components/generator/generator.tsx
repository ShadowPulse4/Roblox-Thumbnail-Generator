"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { KeyRound, Lightbulb, Loader2, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { AspectRatio, GeneratedImageDTO, GenerationDTO, VisualStyle } from "@/types/generation";
import { api, ApiError } from "@/lib/api-client";
import { getSizePlan } from "@/lib/ai/models";
import { getStyleDef } from "@/lib/ai/styles";
import { DEFAULT_OVERLAY } from "@/lib/overlay/layout";
import { MIN_PROMPT_LENGTH } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Notice, Panel } from "@/components/ui/misc";
import { useAppStatus } from "@/components/layout/status-provider";
import { EditImageDialog, Lightbox, OverlayDialog } from "./image-dialogs";
import { PromptBox } from "./prompt-box";
import { toSlots, type ResultActions } from "./result-card";
import { SettingsPanel, type GeneratorSettings } from "./settings-panel";
import { useMissingChars } from "./use-overlay-font";
import { SmallSizeCheck, Viewfinder, type RunState } from "./viewfinder";

export interface GeneratorInitial {
  prompt?: string;
  originalPrompt?: string | null;
  settings?: Partial<GeneratorSettings>;
  generationId?: string | null;
  presetName?: string | null;
}

const POLL_MS = 2000;

const DEFAULT_SETTINGS: GeneratorSettings = {
  aspectRatio: "16:9",
  style: "cinematic-3d",
  quality: "standard",
  count: 1,
  overlayEnabled: false,
  overlay: { ...DEFAULT_OVERLAY, text: "" },
};

interface EnhanceInfo {
  note: string | null;
  suggestedAspectRatio: AspectRatio | null;
  suggestedStyle: VisualStyle | null;
}

export function Generator({ initial }: { initial: GeneratorInitial }) {
  const router = useRouter();
  const { status, refresh } = useAppStatus();
  const caps = status.image.capabilities;
  const maxLength = status.limits.maxPromptLength;

  const [prompt, setPrompt] = React.useState(initial.prompt ?? "");
  const [originalPrompt, setOriginalPrompt] = React.useState<string | null>(initial.originalPrompt ?? null);
  const [settings, setSettings] = React.useState<GeneratorSettings>({ ...DEFAULT_SETTINGS, ...initial.settings });
  const [promptError, setPromptError] = React.useState<string | null>(null);
  const [enhancing, setEnhancing] = React.useState(false);
  const [enhanceInfo, setEnhanceInfo] = React.useState<EnhanceInfo | null>(null);
  const [run, setRun] = React.useState<RunState>(() =>
    initial.generationId ? { phase: "running", generation: null, startedAt: Date.now() } : { phase: "idle" },
  );
  const [history, setHistory] = React.useState<GenerationDTO[]>([]);
  const [lightbox, setLightbox] = React.useState<GeneratedImageDTO | null>(null);
  const [editTarget, setEditTarget] = React.useState<GeneratedImageDTO | null>(null);
  const [overlayTarget, setOverlayTarget] = React.useState<{ image: GeneratedImageDTO; generation: GenerationDTO } | null>(null);
  const [variationBusy, setVariationBusy] = React.useState<string | null>(null);
  const pollRef = React.useRef<{ id: string; timer: ReturnType<typeof setTimeout> | null } | null>(null);
  const lastRequest = React.useRef<(() => Promise<string>) | null>(null);

  const busy = run.phase === "submitting" || run.phase === "running";
  const dims = caps?.aspectRatios[settings.aspectRatio] ?? getSizePlan(status.image.model, settings.aspectRatio).output;
  const overlayForPreview = settings.overlayEnabled && settings.overlay.text.trim() ? settings.overlay : null;
  const missingChars = useMissingChars(settings.overlayEnabled ? settings.overlay : null);

  // Keep the chosen quality valid for the configured model.
  const quality = caps && !caps.quality[settings.quality] ? "standard" : settings.quality;

  const presetToastShown = React.useRef(false);
  React.useEffect(() => {
    if (initial.presetName && !presetToastShown.current) {
      presetToastShown.current = true;
      toast.message(`Stijl “${initial.presetName}” geladen. Pas de prompt gerust aan.`);
    }
  }, [initial.presetName]);

  /* ---------- polling ---------- */

  const stopPolling = React.useCallback(() => {
    if (pollRef.current?.timer) clearTimeout(pollRef.current.timer);
    pollRef.current = null;
  }, []);

  const poll = React.useCallback(
    (id: string, startedAt: number) => {
      stopPolling();
      pollRef.current = { id, timer: null };
      const tick = async () => {
        if (pollRef.current?.id !== id) return;
        try {
          const gen = await api<GenerationDTO>(`/api/generations/${id}`);
          if (pollRef.current?.id !== id) return;
          if (gen.status === "succeeded") {
            stopPolling();
            setRun({ phase: "done", generation: gen });
            setHistory((h) => [gen, ...h.filter((g) => g.id !== gen.id)].slice(0, 12));
            void refresh();
            toast.success(gen.images.length > 1 ? "Je thumbnails zijn klaar." : "Je thumbnail is klaar.");
            return;
          }
          if (gen.status === "failed") {
            stopPolling();
            setRun({ phase: "failed", message: gen.errorMessage ?? "Onbekende fout.", generation: gen });
            void refresh();
            return;
          }
          setRun({ phase: "running", generation: gen, startedAt });
        } catch (e) {
          if (e instanceof ApiError && e.status === 404) {
            stopPolling();
            setRun({ phase: "failed", message: "Deze generatie bestaat niet (meer).", generation: null });
            return;
          }
          // Temporary network hiccup: keep polling.
        }
        if (pollRef.current?.id === id) pollRef.current.timer = setTimeout(tick, POLL_MS);
      };
      void tick();
    },
    [refresh, stopPolling],
  );

  React.useEffect(() => stopPolling, [stopPolling]);

  // Opened with ?generation=<id> (from the gallery, or after a refresh).
  React.useEffect(() => {
    if (initial.generationId) poll(initial.generationId, Date.now());
  }, [initial.generationId, poll]);

  async function start(request: () => Promise<string>) {
    lastRequest.current = request;
    setRun({ phase: "submitting" });
    try {
      const id = await request();
      const startedAt = Date.now();
      setRun({ phase: "running", generation: null, startedAt });
      poll(id, startedAt);
      // Keep the id in the URL so a refresh picks up the same generation.
      window.history.replaceState(null, "", `/?generation=${id}`);
    } catch (e) {
      const message = e instanceof ApiError ? e.message : "Er ging iets mis. Probeer het opnieuw.";
      setRun({ phase: "failed", message, generation: null });
      if (e instanceof ApiError && ["usage_limit", "spend_limit", "rate_limited"].includes(e.code)) {
        toast.error(message);
      }
    }
  }

  /* ---------- actions ---------- */

  function validate(): boolean {
    const text = prompt.trim();
    if (text.length < MIN_PROMPT_LENGTH) {
      setPromptError("Beschrijf je thumbnail in minstens een paar woorden.");
      return false;
    }
    if (text.length > maxLength) {
      setPromptError(`Je prompt is ${text.length - maxLength} tekens te lang.`);
      return false;
    }
    if (settings.overlayEnabled && !settings.overlay.text.trim()) {
      setPromptError("Vul de tekst voor op de thumbnail in, of zet de tekstoptie uit.");
      return false;
    }
    if (settings.overlayEnabled && missingChars.length > 0) {
      setPromptError("De overlaytekst bevat tekens die het lettertype niet kan tekenen.");
      return false;
    }
    setPromptError(null);
    return true;
  }

  function generate() {
    if (busy || !validate()) return;
    const payload = {
      prompt: prompt.trim(),
      originalPrompt,
      aspectRatio: settings.aspectRatio,
      style: settings.style,
      quality,
      count: settings.count,
      overlay: settings.overlayEnabled ? { ...settings.overlay, text: settings.overlay.text.trim() } : null,
    };
    void start(async () => (await api<{ generationId: string }>("/api/generate", { method: "POST", json: payload })).generationId);
  }

  async function enhance() {
    if (!status.text.configured) {
      toast.error("Prompt verbeteren werkt pas als ANTHROPIC_API_KEY is ingesteld. Zie Instellingen.");
      return;
    }
    if (prompt.trim().length < MIN_PROMPT_LENGTH) {
      setPromptError("Typ eerst een idee om te verbeteren.");
      return;
    }
    setEnhancing(true);
    setPromptError(null);
    try {
      const res = await api<EnhanceInfo & { enhancedPrompt: string }>("/api/enhance-prompt", {
        method: "POST",
        json: {
          prompt: prompt.trim(),
          style: settings.style,
          aspectRatio: settings.aspectRatio,
          overlayText: settings.overlayEnabled ? settings.overlay.text.trim() || null : null,
        },
      });
      setOriginalPrompt((o) => o ?? prompt);
      setPrompt(res.enhancedPrompt);
      setEnhanceInfo({ note: res.note, suggestedAspectRatio: res.suggestedAspectRatio, suggestedStyle: res.suggestedStyle });
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Prompt verbeteren is mislukt.");
    } finally {
      setEnhancing(false);
    }
  }

  function restoreOriginal() {
    if (originalPrompt !== null) setPrompt(originalPrompt);
    setOriginalPrompt(null);
    setEnhanceInfo(null);
  }

  function loadGenerationIntoForm(gen: GenerationDTO) {
    setPrompt(gen.enhancedPrompt ?? gen.prompt);
    setOriginalPrompt(gen.enhancedPrompt ? gen.prompt : null);
    setSettings((s) => ({
      ...s,
      aspectRatio: gen.aspectRatio,
      style: gen.visualStyle,
      quality: gen.quality,
      overlayEnabled: Boolean(gen.overlay),
      overlay: gen.overlay ?? s.overlay,
    }));
    document.getElementById("prompt")?.focus();
  }

  const actions: ResultActions = {
    onOpen: setLightbox,
    onEditImage: setEditTarget,
    onOverlay: (image) => {
      const gen = run.phase === "done" ? run.generation : history.find((g) => g.images.some((i) => i.id === image.id));
      if (gen) setOverlayTarget({ image, generation: gen });
    },
    variationBusy,
    onVariations: async (image) => {
      setVariationBusy(image.id);
      const count = Math.min(settings.count, caps?.maxImagesPerRequest ?? 1) as 1 | 2 | 4;
      await start(
        async () =>
          (await api<{ generationId: string }>("/api/variations", {
            method: "POST",
            json: { imageId: image.id, count, quality },
          })).generationId,
      );
      setVariationBusy(null);
    },
    onRegenerate: (gen) => {
      if (gen.kind === "generate") {
        void start(
          async () =>
            (await api<{ generationId: string }>("/api/generate", {
              method: "POST",
              json: {
                prompt: gen.enhancedPrompt ?? gen.prompt,
                originalPrompt: gen.enhancedPrompt ? gen.prompt : null,
                aspectRatio: gen.aspectRatio,
                style: gen.visualStyle,
                quality: gen.quality,
                count: [1, 2, 4].includes(gen.imageCount) ? gen.imageCount : 1,
                overlay: gen.overlay,
              },
            })).generationId,
        );
      } else if (gen.parentImageId) {
        const parent = gen.parentImageId;
        void start(async () =>
          gen.kind === "edit"
            ? (await api<{ generationId: string }>("/api/edit", {
                method: "POST",
                json: { imageId: parent, instruction: gen.prompt, quality: gen.quality },
              })).generationId
            : (await api<{ generationId: string }>("/api/variations", {
                method: "POST",
                json: { imageId: parent, count: [1, 2, 4].includes(gen.imageCount) ? gen.imageCount : 1, quality: gen.quality },
              })).generationId,
        );
      }
    },
    onEditPrompt: loadGenerationIntoForm,
  };

  const resultImage = run.phase === "done" ? (toSlots(run.generation)[0]?.withText ?? toSlots(run.generation)[0]?.original ?? null) : null;

  const enhanceNote =
    enhanceInfo && (enhanceInfo.note || enhanceInfo.suggestedAspectRatio || enhanceInfo.suggestedStyle) ? (
      <Notice tone="accent" icon={<Lightbulb className="text-[#c9bcff]" />} title="Verbeterd door Claude">
        {enhanceInfo.note ? <p>{enhanceInfo.note}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          {enhanceInfo.suggestedAspectRatio ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSettings((s) => ({ ...s, aspectRatio: enhanceInfo.suggestedAspectRatio! }));
                setEnhanceInfo((i) => (i ? { ...i, suggestedAspectRatio: null } : i));
              }}
            >
              Gebruik {enhanceInfo.suggestedAspectRatio}
            </Button>
          ) : null}
          {enhanceInfo.suggestedStyle ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSettings((s) => ({ ...s, style: enhanceInfo.suggestedStyle! }));
                setEnhanceInfo((i) => (i ? { ...i, suggestedStyle: null } : i));
              }}
            >
              Gebruik stijl {getStyleDef(enhanceInfo.suggestedStyle).label}
            </Button>
          ) : null}
        </div>
      </Notice>
    ) : originalPrompt !== null ? (
      <p className="text-xs text-subtle">
        Dit is de verbeterde prompt (in het Engels, dat werkt het best voor het beeldmodel). Je kunt hem nog aanpassen.
      </p>
    ) : null;

  return (
    // Mobile order: prompt, canvas, settings. On wide screens the canvas sits on the right across both rows.
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(380px,480px)_minmax(0,1fr)] xl:grid-rows-[auto_1fr] xl:gap-x-8">
      {/* Prompt */}
      <div className="space-y-5 xl:col-start-1 xl:row-start-1">
        {status.openAccessBlocked ? (
          <Notice tone="danger" icon={<ShieldAlert className="text-danger" />} title="Genereren is geblokkeerd">
            Deze installatie draait in productie zonder login. Zet AUTH_MODE=local in je omgevingsvariabelen zodat niet iedereen je API-tegoed kan gebruiken.
          </Notice>
        ) : !status.image.configured ? (
          <Notice
            tone="warning"
            icon={<KeyRound className="text-warning" />}
            title="Nog geen beeldmodel ingesteld"
            action={
              <Link href="/settings" className="text-sm font-medium text-fg underline underline-offset-4">
                Zo stel je het in
              </Link>
            }
          >
            Voeg OPENAI_API_KEY toe aan <code className="text-fg">.env.local</code> en herstart de app. De rest van de app werkt al.
          </Notice>
        ) : null}

        <Panel className="p-4 sm:p-5">
          <PromptBox
            value={prompt}
            onChange={(v) => {
              setPrompt(v);
              if (promptError) setPromptError(null);
            }}
            maxLength={maxLength}
            error={promptError}
            disabled={busy}
            onSubmit={generate}
            onEnhance={enhance}
            enhancing={enhancing}
            enhanceAvailable={status.text.configured}
            originalPrompt={originalPrompt}
            onRestoreOriginal={restoreOriginal}
            enhanceNote={enhanceNote}
          />
          <Button
            variant="primary"
            size="lg"
            className="mt-4 w-full"
            onClick={generate}
            disabled={busy || enhancing || !status.image.configured || status.openAccessBlocked || prompt.trim().length === 0}
          >
            {busy ? <Loader2 className="animate-spin" /> : <Sparkles />}
            {busy ? "Bezig met genereren…" : settings.count > 1 ? `${settings.count} thumbnails genereren` : "Thumbnail genereren"}
          </Button>
        </Panel>
      </div>

      {/* Canvas */}
      <div className="space-y-4 xl:sticky xl:top-8 xl:col-start-2 xl:row-span-2 xl:row-start-1">
        <Viewfinder
          state={run}
          ratio={run.phase === "done" ? run.generation.aspectRatio : settings.aspectRatio}
          dims={dims}
          overlay={overlayForPreview}
          actions={actions}
          onRetry={() => (lastRequest.current ? void start(lastRequest.current) : generate())}
          providerReady={status.image.configured}
        />
        {resultImage ? <SmallSizeCheck image={resultImage} alt="Kleine versie van je thumbnail" /> : null}

        {history.length > 1 ? (
          <div>
            <h2 className="mb-2 text-sm font-medium text-muted">Eerder in deze sessie</h2>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {history.slice(1).map((g) => {
                const img = toSlots(g)[0];
                if (!img) return null;
                const shown = img.withText ?? img.original;
                return (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setRun({ phase: "done", generation: g })}
                    className="relative h-16 shrink-0 overflow-hidden rounded-[var(--radius-chip)] border border-line hover:border-line-strong"
                    style={{ aspectRatio: `${shown.width} / ${shown.height}` }}
                    aria-label={`Toon: ${g.prompt.slice(0, 60)}`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={shown.url} alt="" className="size-full object-cover" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* Settings */}
      <div className="xl:col-start-1 xl:row-start-2">
        <Panel className="p-4 sm:p-5">
          <h2 className="mb-4 text-base font-semibold">Instellingen</h2>
          <SettingsPanel
            settings={{ ...settings, quality }}
            onChange={setSettings}
            capabilities={caps}
            maxImages={status.limits.maxImagesPerRequest}
            missingChars={missingChars}
          />
        </Panel>
      </div>

      <Lightbox image={lightbox} alt="Thumbnail op volledige grootte" open={lightbox !== null} onOpenChange={(o) => !o && setLightbox(null)} />
      <EditImageDialog
        image={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => !o && setEditTarget(null)}
        defaultQuality={quality}
        onStarted={(id) => {
          lastRequest.current = null;
          const startedAt = Date.now();
          setRun({ phase: "running", generation: null, startedAt });
          poll(id, startedAt);
          window.history.replaceState(null, "", `/?generation=${id}`);
        }}
      />
      <OverlayDialog
        image={overlayTarget?.image ?? null}
        generation={overlayTarget?.generation ?? null}
        open={overlayTarget !== null}
        onOpenChange={(o) => !o && setOverlayTarget(null)}
        onDone={(gen) => {
          setRun({ phase: "done", generation: gen });
          setHistory((h) => [gen, ...h.filter((g) => g.id !== gen.id)]);
          router.refresh();
        }}
      />
    </div>
  );
}
