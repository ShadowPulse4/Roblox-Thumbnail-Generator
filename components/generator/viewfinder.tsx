"use client";

import * as React from "react";
import Image from "next/image";
import { AlertTriangle, ImageIcon, Loader2 } from "lucide-react";
import type { AspectRatio, GenerationDTO, TextOverlay } from "@/types/generation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { OverlayPreview } from "./overlay-preview";
import { ResultCard, toSlots, type ResultActions } from "./result-card";

export type RunState =
  | { phase: "idle" }
  | { phase: "submitting" }
  | { phase: "running"; generation: GenerationDTO | null; startedAt: number }
  | { phase: "done"; generation: GenerationDTO }
  | { phase: "failed"; message: string; generation: GenerationDTO | null };

function useElapsed(startedAt: number | null) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [startedAt]);
  if (startedAt === null) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

function formatElapsed(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function runningLabel(gen: GenerationDTO | null) {
  if (!gen || gen.status === "pending") return "Verzoek klaarzetten";
  const what = gen.kind === "edit" ? "past je afbeelding aan" : gen.kind === "variation" ? "maakt variaties" : "maakt je thumbnail";
  return `${gen.imageProvider === "openai" ? "OpenAI" : gen.imageProvider} ${what}`;
}

/** The empty or in-progress canvas, framed in the selected aspect ratio. */
function Frame({
  ratio,
  dims,
  overlay,
  children,
  className,
}: {
  ratio: AspectRatio;
  dims: { width: number; height: number };
  overlay: TextOverlay | null;
  children?: React.ReactNode;
  className?: string;
}) {
  const [w, h] = ratio.split(":").map(Number);
  const tall = h > w;
  return (
    <div className={cn("viewfinder p-2.5", className)}>
      <div
        className={cn(
          "stud-grid relative mx-auto overflow-hidden rounded-[var(--radius-control)] border border-line bg-bg-raised/80",
          tall ? "h-[min(64vh,620px)]" : "w-full",
        )}
        style={{ aspectRatio: `${w} / ${h}` }}
      >
        {overlay ? <OverlayPreview overlay={overlay} width={dims.width} height={dims.height} /> : null}
        {children}
      </div>
    </div>
  );
}

export function Viewfinder({
  state,
  ratio,
  dims,
  overlay,
  actions,
  onRetry,
  providerReady,
}: {
  state: RunState;
  ratio: AspectRatio;
  dims: { width: number; height: number };
  overlay: TextOverlay | null;
  actions: ResultActions;
  onRetry: () => void;
  providerReady: boolean;
}) {
  const running = state.phase === "running" || state.phase === "submitting";
  const elapsed = useElapsed(state.phase === "running" ? state.startedAt : null);

  if (state.phase === "done") {
    const slots = toSlots(state.generation);
    if (slots.length === 0) {
      return (
        <Frame ratio={ratio} dims={dims} overlay={null}>
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
            Deze generatie heeft geen afbeeldingen meer.
          </div>
        </Frame>
      );
    }
    return (
      <div className={cn("grid gap-4", slots.length > 1 && "sm:grid-cols-2")} aria-live="polite">
        {slots.map((slot) => (
          <ResultCard key={slot.original.id} slot={slot} generation={state.generation} actions={actions} compact={slots.length > 1} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <Frame ratio={ratio} dims={dims} overlay={state.phase === "idle" ? overlay : null}>
        {running ? (
          <div className="scan-bar absolute inset-0 grid place-items-center" role="status" aria-live="polite">
            <div className="relative z-10 flex flex-col items-center gap-3 rounded-[var(--radius-control)] bg-bg/75 px-5 py-4 text-center backdrop-blur">
              <Loader2 className="size-6 animate-spin text-accent" aria-hidden />
              <div>
                <p className="text-sm font-medium">
                  {state.phase === "submitting" ? "Verzoek versturen" : runningLabel(state.generation)}
                </p>
                <p className="mt-0.5 text-xs tabular-nums text-muted">
                  {formatElapsed(elapsed)} bezig. Dit kan een minuut of langer duren.
                </p>
              </div>
            </div>
          </div>
        ) : state.phase === "failed" ? (
          <div className="absolute inset-0 grid place-items-center p-6" role="alert">
            <div className="max-w-sm rounded-[var(--radius-control)] border border-danger/40 bg-bg/85 p-4 text-center backdrop-blur">
              <AlertTriangle className="mx-auto mb-2 size-5 text-danger" aria-hidden />
              <p className="text-sm font-medium">Genereren is mislukt</p>
              <p className="mt-1 text-[13px] text-muted">{state.message}</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={onRetry}>
                Opnieuw proberen
              </Button>
            </div>
          </div>
        ) : !overlay ? (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div className="max-w-xs">
              <ImageIcon className="mx-auto mb-2 size-6 text-subtle" aria-hidden />
              <p className="text-sm text-muted">
                {providerReady
                  ? "Je thumbnail verschijnt hier, precies in deze verhouding."
                  : "Stel eerst een beeldmodel in om te kunnen genereren."}
              </p>
              <p className="mt-1 text-xs text-subtle">
                {dims.width} × {dims.height} px
              </p>
            </div>
          </div>
        ) : null}
      </Frame>
    </div>
  );
}

/** Shows the thumbnail at the size people actually see it in lists and sidebars. */
export function SmallSizeCheck({ image, alt }: { image: { url: string; width: number; height: number } | null; alt: string }) {
  if (!image) return null;
  const width = 168;
  const height = Math.round((width * image.height) / image.width);
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-bg-raised/60 p-3">
      <div className="relative shrink-0 overflow-hidden rounded-[6px] border border-line" style={{ width, height: Math.min(height, 168) }}>
        <Image src={image.url} alt={alt} fill unoptimized sizes="168px" className="object-cover" />
      </div>
      <div className="text-xs text-muted">
        <p className="text-[13px] font-medium text-fg">Leesbaarheidscheck</p>
        <p className="mt-1">
          Zo ziet je thumbnail eruit op 168 pixels breed, ongeveer het formaat in zijbalken en lijsten. Is het onderwerp hier nog duidelijk?
        </p>
      </div>
    </div>
  );
}
