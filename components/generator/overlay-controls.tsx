"use client";

import * as React from "react";
import {
  AlignCenter,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
} from "lucide-react";
import { OVERLAY_FONTS, OVERLAY_STYLES, type OverlayArrow, type OverlayPosition, type TextOverlay } from "@/types/generation";
import { DEFAULT_OVERLAY, MAX_OVERLAY_LINES, OVERLAY_FONT_LABELS, OVERLAY_PRESETS, OVERLAY_STYLE_LABELS, shade } from "@/lib/overlay/layout";
import { MAX_OVERLAY_TEXT } from "@/lib/validation/schemas";
import { Label, Textarea } from "@/components/ui/field";
import { Segmented, Slider } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

const POSITIONS: { value: OverlayPosition; label: string; icon: React.ElementType; area: string }[] = [
  { value: "top-left", label: "Linksboven", icon: ArrowUpLeft, area: "1 / 1" },
  { value: "top", label: "Boven", icon: ArrowUp, area: "1 / 2" },
  { value: "top-right", label: "Rechtsboven", icon: ArrowUpRight, area: "1 / 3" },
  { value: "center", label: "Midden", icon: AlignCenter, area: "2 / 2" },
  { value: "bottom-left", label: "Linksonder", icon: ArrowDownLeft, area: "3 / 1" },
  { value: "bottom", label: "Onder", icon: ArrowDown, area: "3 / 2" },
  { value: "bottom-right", label: "Rechtsonder", icon: ArrowDownRight, area: "3 / 3" },
];

const SUGGESTIONS = ["EPIC BOSSES", "NEW UPDATE!", "10 NEW BIOMES!", "SPECIAL PET", "600K P/S", "YOU"];

const SWATCHES = ["#FFE14D", "#FF6A00", "#FFFFFF", "#7CFF6B", "#3AD0FF", "#FF4D6D", "#1A0E05", "#000000"];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-8 w-9 cursor-pointer rounded-[var(--radius-chip)] border border-line bg-transparent p-0.5"
        />
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`${label}: ${c}`}
            className={cn(
              "size-6 rounded-full border transition-transform hover:scale-110",
              value.toUpperCase() === c ? "border-white ring-2 ring-accent" : "border-line-strong",
            )}
            style={{ background: c }}
          />
        ))}
      </div>
    </div>
  );
}

export function OverlayControls({
  overlay,
  onChange,
  missingChars,
}: {
  overlay: TextOverlay;
  onChange: (o: TextOverlay) => void;
  missingChars: string[];
}) {
  const set = <K extends keyof TextOverlay>(key: K, v: TextOverlay[K]) => onChange({ ...overlay, [key]: v });
  const style = overlay.style ?? "outline";
  const lineCount = overlay.text.split(/\r?\n/).filter((l) => l.trim()).length;

  function applyPreset(id: string) {
    const preset = OVERLAY_PRESETS.find((p) => p.id === id);
    if (!preset) return;
    // Keep what the user typed; only fill in the preset's text when the field is empty.
    onChange({ ...preset.overlay, text: overlay.text.trim() ? overlay.text : (preset.text ?? "") });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label>Snelle stijlen</Label>
        <div className="flex flex-wrap gap-1.5">
          {OVERLAY_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => applyPreset(p.id)}
              className="rounded-[var(--radius-chip)] border border-line bg-bg-raised px-2.5 py-1 text-xs text-fg hover:border-accent-line"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="overlay-text">Tekst</Label>
        <Textarea
          id="overlay-text"
          rows={2}
          value={overlay.text}
          maxLength={MAX_OVERLAY_TEXT}
          onChange={(e) => set("text", e.target.value)}
          onKeyDown={(e) => {
            // Stop a fourth line before it is typed.
            if (e.key === "Enter" && !e.ctrlKey && !e.metaKey && lineCount >= MAX_OVERLAY_LINES) e.preventDefault();
          }}
          placeholder={"EPIC\nBOSSES"}
          aria-describedby="overlay-text-help"
          className="font-medium"
        />
        <div id="overlay-text-help" className="flex flex-wrap gap-1.5 pt-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("text", s === "EPIC BOSSES" ? "EPIC\nBOSSES" : s)}
              className="rounded-[var(--radius-chip)] border border-line px-2 py-0.5 text-xs text-muted hover:border-line-strong hover:text-fg"
            >
              {s}
            </button>
          ))}
        </div>
        {missingChars.length > 0 ? (
          <p className="text-xs text-warning">
            Dit lettertype kan {missingChars.join(" ")} niet tekenen. Pas de tekst aan of kies een ander lettertype.
          </p>
        ) : (
          <p className="text-xs text-subtle">
            Enter voor een nieuwe regel (maximaal {MAX_OVERLAY_LINES}). De tekst komt er precies zo op als je hem typt.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Opmaak</Label>
        <Segmented
          size="sm"
          label="Opmaak van de tekst"
          value={style}
          onChange={(v) =>
            onChange({
              ...overlay,
              style: v,
              // A gradient needs a second color; derive one when switching to the 3D title.
              fillColor2: v === "title" ? (overlay.fillColor2 ?? shade(overlay.fillColor, -0.35)) : overlay.fillColor2,
            })
          }
          options={OVERLAY_STYLES.map((s) => ({ value: s, label: OVERLAY_STYLE_LABELS[s] }))}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Lettertype</Label>
            <Segmented
              size="sm"
              label="Lettertype"
              value={overlay.font}
              onChange={(v) => set("font", v)}
              options={OVERLAY_FONTS.map((f) => ({ value: f, label: OVERLAY_FONT_LABELS[f] }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Pijl naar het onderwerp</Label>
            <Segmented
              size="sm"
              label="Pijl"
              value={overlay.arrow ?? "none"}
              onChange={(v: OverlayArrow) => set("arrow", v)}
              options={[
                { value: "none", label: "Geen" },
                { value: "down-left", label: "Linksonder" },
                { value: "down-right", label: "Rechtsonder" },
              ]}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label id="pos-label">Positie</Label>
          <div role="radiogroup" aria-labelledby="pos-label" className="grid w-[108px] grid-cols-3 grid-rows-3 gap-1">
            {POSITIONS.map(({ value, label, icon: Icon, area }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={overlay.position === value}
                aria-label={label}
                title={label}
                onClick={() => set("position", value)}
                style={{ gridArea: area }}
                className={cn(
                  "grid h-7 place-items-center rounded-[var(--radius-chip)] border text-muted transition-colors",
                  overlay.position === value
                    ? "border-accent bg-accent-soft text-fg"
                    : "border-line hover:border-line-strong hover:text-fg",
                )}
              >
                <Icon className="size-3.5" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-2">
          <div className="flex justify-between text-[13px]">
            <span className="font-medium text-muted">Grootte</span>
            <span className="tabular-nums text-subtle">{overlay.sizePercent}%</span>
          </div>
          <Slider label="Grootte" value={overlay.sizePercent} onChange={(v) => set("sizePercent", v)} min={4} max={30} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[13px]">
            <span className="font-medium text-muted">Rand</span>
            <span className="tabular-nums text-subtle">{overlay.outlinePercent}%</span>
          </div>
          <Slider label="Randdikte" value={overlay.outlinePercent} onChange={(v) => set("outlinePercent", v)} min={0} max={25} />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between text-[13px]">
            <span className="font-medium text-muted">Kanteling</span>
            <span className="tabular-nums text-subtle">{overlay.rotation}°</span>
          </div>
          <Slider label="Kanteling" value={overlay.rotation} onChange={(v) => set("rotation", v)} min={-15} max={15} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField label={style === "title" ? "Kleur boven" : "Tekstkleur"} value={overlay.fillColor} onChange={(v) => set("fillColor", v)} />
        {style === "title" ? (
          <ColorField
            label="Kleur onder"
            value={overlay.fillColor2 ?? DEFAULT_OVERLAY.fillColor2!}
            onChange={(v) => set("fillColor2", v)}
          />
        ) : null}
        <ColorField
          label={style === "label" ? "Kleur van het label" : "Randkleur"}
          value={overlay.outlineColor}
          onChange={(v) => set("outlineColor", v)}
        />
      </div>
    </div>
  );
}
