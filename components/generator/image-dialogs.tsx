"use client";

import * as React from "react";
import Image from "next/image";
import { Loader2, PencilLine, Type } from "lucide-react";
import { toast } from "sonner";
import type { GeneratedImageDTO, GenerationDTO, QualityLevel, TextOverlay } from "@/types/generation";
import { api, ApiError } from "@/lib/api-client";
import { DEFAULT_OVERLAY } from "@/lib/overlay/layout";
import { MAX_EDIT_INSTRUCTION } from "@/lib/validation/schemas";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { FieldError, Label, Textarea } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/controls";
import { useAppStatus } from "@/components/layout/status-provider";
import { OverlayControls } from "./overlay-controls";
import { OverlayPreview } from "./overlay-preview";
import { useMissingChars } from "./use-overlay-font";

const EDIT_EXAMPLES = [
  "Maak de achtergrond paars",
  "Vervang de draak door een gigantische nugget",
  "Maak het personage groter",
  "Haal de groene gloed weg",
  "Geef het personage een gouden kroon",
  "Maak de afbeelding helderder",
  "Houd alles hetzelfde maar maak het scherper en gedetailleerder",
];

/* ---------- Lightbox ---------- */

export function Lightbox({
  image,
  alt,
  open,
  onOpenChange,
}: {
  image: GeneratedImageDTO | null;
  alt: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  if (!image) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent title="Voorbeeld" description={`${image.width} × ${image.height} px`} className="max-w-[min(1400px,96vw)]" wide>
        <div className="relative mx-auto" style={{ aspectRatio: `${image.width} / ${image.height}`, maxHeight: "78vh" }}>
          <Image src={image.url} alt={alt} fill unoptimized sizes="96vw" className="rounded-[var(--radius-control)] object-contain" />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Edit an image ---------- */

export function EditImageDialog({
  image,
  open,
  onOpenChange,
  onStarted,
  defaultQuality = "standard",
}: {
  image: GeneratedImageDTO | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onStarted: (generationId: string) => void;
  defaultQuality?: QualityLevel;
}) {
  const { status } = useAppStatus();
  const caps = status.image.capabilities;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Afbeelding bewerken"
        description="Beschrijf wat er anders moet. Het origineel blijft bewaard; de bewerking wordt een nieuwe afbeelding."
        wide
      >
        {!status.image.configured ? (
          <Notice tone="warning" title="Geen beeldmodel ingesteld">
            Voeg eerst een OPENAI_API_KEY toe om te kunnen bewerken.
          </Notice>
        ) : !caps?.edit ? (
          <Notice tone="warning" title="Bewerken wordt niet ondersteund">
            Het ingestelde model ({status.image.model}) kan geen bestaande afbeeldingen aanpassen. Genereer een nieuwe afbeelding met een aangepaste prompt.
          </Notice>
        ) : (
          // Content unmounts when the dialog closes, so the form starts fresh every time.
          <EditForm
            image={image}
            capsQuality={caps.quality}
            initialQuality={caps.quality[defaultQuality] ? defaultQuality : "standard"}
            onCancel={() => onOpenChange(false)}
            onStarted={(id) => {
              onOpenChange(false);
              onStarted(id);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  image,
  capsQuality,
  initialQuality,
  onCancel,
  onStarted,
}: {
  image: GeneratedImageDTO | null;
  capsQuality: Partial<Record<QualityLevel, string>>;
  initialQuality: QualityLevel;
  onCancel: () => void;
  onStarted: (generationId: string) => void;
}) {
  const [instruction, setInstruction] = React.useState("");
  const [quality, setQuality] = React.useState<QualityLevel>(initialQuality);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!image) return;
    if (instruction.trim().length < 3) {
      setError("Beschrijf wat er moet veranderen.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ generationId: string }>("/api/edit", {
        method: "POST",
        json: { imageId: image.id, instruction: instruction.trim(), quality },
      });
      onStarted(res.generationId);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Bewerken is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
          <div className="grid gap-5 md:grid-cols-[240px_1fr]">
            {image ? (
              <div className="relative self-start overflow-hidden rounded-[var(--radius-control)] border border-line" style={{ aspectRatio: `${image.width} / ${image.height}` }}>
                <Image src={image.url} alt="Afbeelding die je bewerkt" fill unoptimized sizes="240px" className="object-cover" />
              </div>
            ) : null}
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="edit-instruction">Wat moet er veranderen?</Label>
                <Textarea
                  id="edit-instruction"
                  rows={4}
                  value={instruction}
                  maxLength={MAX_EDIT_INSTRUCTION}
                  onChange={(e) => setInstruction(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      void submit();
                    }
                  }}
                  placeholder="Bijv. vervang de draak door een gigantische gouden nugget"
                />
                <div className="flex flex-wrap gap-1.5">
                  {EDIT_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setInstruction(ex)}
                      className="rounded-[var(--radius-chip)] border border-line px-2 py-0.5 text-xs text-muted hover:border-line-strong hover:text-fg"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-subtle">
                  Wil je tekst toevoegen, zoals “SPECIAL PET”? Gebruik dan “Tekst toevoegen”: dat zet de tekst er foutloos op.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Kwaliteit</Label>
                <Segmented
                  size="sm"
                  label="Kwaliteit"
                  value={quality}
                  onChange={setQuality}
                  options={(["standard", "high", "ultra"] as const).map((q) => ({
                    value: q,
                    label: q === "standard" ? "Standaard" : q === "high" ? "Hoog" : "Ultra",
                    disabled: !capsQuality[q],
                  }))}
                />
              </div>
              <FieldError>{error}</FieldError>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                  Annuleren
                </Button>
                <Button variant="primary" onClick={submit} disabled={busy}>
                  {busy ? <Loader2 className="animate-spin" /> : <PencilLine />}
                  Bewerking starten
                </Button>
              </div>
            </div>
          </div>
  );
}

/* ---------- Add or change a text overlay ---------- */

export function OverlayDialog({
  image,
  generation,
  open,
  onOpenChange,
  onDone,
}: {
  image: GeneratedImageDTO | null;
  generation: Pick<GenerationDTO, "overlay"> | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: (generation: GenerationDTO, image: GeneratedImageDTO) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={image?.overlay ? "Tekst aanpassen" : "Tekst toevoegen"}
        description="De tekst wordt lokaal op de afbeelding gezet. Dit kost geen API-tegoed."
        wide
        className="max-w-5xl"
      >
        {image ? (
          <OverlayForm
            image={image}
            initial={image.overlay ?? generation?.overlay ?? { ...DEFAULT_OVERLAY, text: "" }}
            onCancel={() => onOpenChange(false)}
            onDone={(g, i) => {
              onOpenChange(false);
              onDone(g, i);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function OverlayForm({
  image,
  initial,
  onCancel,
  onDone,
}: {
  image: GeneratedImageDTO;
  initial: TextOverlay;
  onCancel: () => void;
  onDone: (generation: GenerationDTO, image: GeneratedImageDTO) => void;
}) {
  const [overlay, setOverlay] = React.useState<TextOverlay>(initial);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const missing = useMissingChars(overlay);

  async function submit() {
    if (!image) return;
    if (!overlay.text.trim()) {
      setError("Vul de tekst in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ generation: GenerationDTO; image: GeneratedImageDTO }>("/api/overlay", {
        method: "POST",
        json: { imageId: image.id, overlay: { ...overlay, text: overlay.text } },
      });
      toast.success("Tekst toegevoegd. Het origineel zonder tekst blijft bewaard.");
      onDone(res.generation, res.image);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Tekst toevoegen is mislukt.");
    } finally {
      setBusy(false);
    }
  }

  // Preview on the left, controls on the right, so the action stays in view.
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
      <div className="lg:sticky lg:top-0 lg:self-start">
        <div
          className="relative overflow-hidden rounded-[var(--radius-control)] border border-line bg-black/30"
          style={{ aspectRatio: `${image.width} / ${image.height}`, maxHeight: "60vh", marginInline: "auto" }}
        >
          <Image
            // Always preview on the image without text.
            src={image.overlay && image.parentImageId ? `/api/images/${image.parentImageId}` : image.url}
            alt="Afbeelding waarop de tekst komt"
            fill
            unoptimized
            sizes="(max-width: 1024px) 96vw, 560px"
            className="object-contain"
          />
          <OverlayPreview overlay={overlay} width={image.width} height={image.height} />
        </div>
        <p className="mt-2 text-xs text-subtle">Voorbeeld met het echte lettertype. Het resultaat wordt een nieuwe afbeelding; het origineel blijft bewaard.</p>
      </div>
      <div className="space-y-5">
        <OverlayControls overlay={overlay} onChange={setOverlay} missingChars={missing} />
        <FieldError>{error}</FieldError>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onCancel}>
            Annuleren
          </Button>
          <Button variant="primary" onClick={submit} disabled={busy || missing.length > 0}>
            {busy ? <Loader2 className="animate-spin" /> : <Type />}
            Tekst plaatsen
          </Button>
        </div>
      </div>
    </div>
  );
}
