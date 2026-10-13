"use client";

import * as React from "react";
import Image from "next/image";
import {
  Copy,
  Download,
  Expand,
  Heart,
  Loader2,
  PencilLine,
  RefreshCw,
  Shuffle,
  TextCursorInput,
  Type,
} from "lucide-react";
import { toast } from "sonner";
import type { GeneratedImageDTO, GenerationDTO } from "@/types/generation";
import { api, ApiError } from "@/lib/api-client";
import { getStyleDef } from "@/lib/ai/styles";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { Tip } from "@/components/ui/controls";

/** One generated image, plus the version with a text overlay when there is one. */
export interface ImageSlot {
  original: GeneratedImageDTO;
  withText: GeneratedImageDTO | null;
}

export function toSlots(generation: GenerationDTO): ImageSlot[] {
  const originals = generation.images.filter((i) => !i.overlay);
  return originals.map((original) => {
    const overlays = generation.images.filter((i) => i.overlay && i.parentImageId === original.id);
    return { original, withText: overlays.at(-1) ?? null };
  });
}

export function useFavorite(image: GeneratedImageDTO) {
  // Local override after a click; falls back to the server value for other images.
  const [override, setOverride] = React.useState<{ id: string; fav: boolean } | null>(null);
  const fav = override?.id === image.id ? override.fav : image.isFavorite;
  const toggle = React.useCallback(async () => {
    const next = !fav;
    setOverride({ id: image.id, fav: next });
    try {
      await api(`/api/images/${image.id}/favorite`, { method: next ? "PUT" : "DELETE" });
      toast.success(next ? "Toegevoegd aan favorieten." : "Verwijderd uit favorieten.");
    } catch (e) {
      setOverride({ id: image.id, fav: !next });
      toast.error(e instanceof ApiError ? e.message : "Favoriet opslaan is mislukt.");
    }
  }, [fav, image.id]);
  return [fav, toggle] as const;
}

export function downloadImage(image: GeneratedImageDTO) {
  const a = document.createElement("a");
  a.href = `${image.url}?download=1`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Prompt gekopieerd.");
  } catch {
    toast.error("Kopiëren lukt niet in deze browser.");
  }
}

export interface ResultActions {
  onOpen: (image: GeneratedImageDTO) => void;
  onEditImage: (image: GeneratedImageDTO) => void;
  onOverlay: (image: GeneratedImageDTO) => void;
  onVariations: (image: GeneratedImageDTO) => void;
  onRegenerate: (generation: GenerationDTO) => void;
  onEditPrompt: (generation: GenerationDTO) => void;
  variationBusy: string | null;
}

export function ResultCard({
  slot,
  generation,
  actions,
  compact,
}: {
  slot: ImageSlot;
  generation: GenerationDTO;
  actions: ResultActions;
  compact?: boolean;
}) {
  const [showText, setShowText] = React.useState(true);
  const current = showText && slot.withText ? slot.withText : slot.original;
  const [fav, toggleFav] = useFavorite(current);
  const promptUsed = generation.enhancedPrompt ?? generation.prompt;
  const alt = `Gegenereerde thumbnail: ${generation.prompt.slice(0, 140)}`;

  return (
    <figure className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel">
      <div className="group relative bg-black/30" style={{ aspectRatio: `${current.width} / ${current.height}` }}>
        <Image
          src={current.url}
          alt={alt}
          fill
          unoptimized
          loading="eager"
          sizes={compact ? "(max-width: 1024px) 50vw, 30vw" : "(max-width: 1024px) 96vw, 60vw"}
          className="object-contain"
        />
        <button
          type="button"
          onClick={() => actions.onOpen(current)}
          className="absolute inset-0 flex items-end justify-end p-2.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
          aria-label="Groot bekijken"
        >
          <span className="rounded-[var(--radius-chip)] bg-black/60 p-1.5 text-white backdrop-blur">
            <Expand className="size-4" />
          </span>
        </button>
      </div>

      <figcaption className="space-y-3 p-3.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge>
            {current.width} × {current.height}
          </Badge>
          <Badge>{getStyleDef(generation.visualStyle).label}</Badge>
          <Badge>
            {generation.imageModel} ({generation.providerQuality})
          </Badge>
          {generation.kind !== "generate" ? (
            <Badge tone="accent">{generation.kind === "edit" ? "Bewerking" : "Variatie"}</Badge>
          ) : null}
          {slot.withText ? (
            <button
              type="button"
              onClick={() => setShowText((s) => !s)}
              className="ml-auto inline-flex items-center gap-1 rounded-[var(--radius-chip)] border border-line px-1.5 py-0.5 text-[11.5px] text-muted hover:text-fg"
              aria-pressed={showText}
            >
              <Type className="size-3" />
              {showText ? "Met tekst" : "Zonder tekst"}
            </button>
          ) : null}
        </div>

        {!compact ? (
          <p className="line-clamp-3 text-[13px] leading-relaxed text-muted" title={promptUsed}>
            {promptUsed}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="primary" onClick={() => downloadImage(current)}>
            <Download />
            Downloaden
          </Button>
          <Tip content={fav ? "Uit favorieten" : "Aan favorieten toevoegen"}>
            <Button size="icon-sm" variant="ghost" onClick={toggleFav} aria-pressed={fav} aria-label="Favoriet">
              <Heart className={cn(fav && "fill-[#ff5c8a] text-[#ff5c8a]")} />
            </Button>
          </Tip>
          <Tip content="Afbeelding bewerken">
            <Button size="icon-sm" variant="ghost" onClick={() => actions.onEditImage(current)} aria-label="Afbeelding bewerken">
              <PencilLine />
            </Button>
          </Tip>
          <Tip content={slot.withText ? "Tekst aanpassen" : "Tekst toevoegen"}>
            <Button size="icon-sm" variant="ghost" onClick={() => actions.onOverlay(current)} aria-label="Tekst toevoegen of aanpassen">
              <Type />
            </Button>
          </Tip>
          <Tip content="Variaties maken">
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => actions.onVariations(current)}
              disabled={actions.variationBusy === current.id}
              aria-label="Variaties maken"
            >
              {actions.variationBusy === current.id ? <Loader2 className="animate-spin" /> : <Shuffle />}
            </Button>
          </Tip>
          <Tip content="Opnieuw genereren met dezelfde instellingen">
            <Button size="icon-sm" variant="ghost" onClick={() => actions.onRegenerate(generation)} aria-label="Opnieuw genereren">
              <RefreshCw />
            </Button>
          </Tip>
          <Tip content="Prompt kopiëren">
            <Button size="icon-sm" variant="ghost" onClick={() => copyText(promptUsed)} aria-label="Prompt kopiëren">
              <Copy />
            </Button>
          </Tip>
          <Tip content="Prompt terugzetten om aan te passen">
            <Button size="icon-sm" variant="ghost" onClick={() => actions.onEditPrompt(generation)} aria-label="Prompt aanpassen">
              <TextCursorInput />
            </Button>
          </Tip>
        </div>
      </figcaption>
    </figure>
  );
}
