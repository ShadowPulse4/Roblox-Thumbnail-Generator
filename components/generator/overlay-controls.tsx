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
import { OVERLAY_FONTS, type OverlayPosition, type TextOverlay } from "@/types/generation";
import { OVERLAY_FONT_LABELS } from "@/lib/overlay/layout";
import { MAX_OVERLAY_TEXT } from "@/lib/validation/schemas";
import { Input, Label } from "@/components/ui/field";
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

const SUGGESTIONS = ["NEW UPDATE!", "10 NEW BIOMES!", "EPIC BOSS!", "600K P/S"];

const SWATCHES = ["#FFD23F", "#FFFFFF", "#7CFF6B", "#3AD0FF", "#FF4D6D", "#1A1033", "#000000"];

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const id = React.useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-1.5">
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
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="overlay-text">Tekst</Label>
        <Input
          id="overlay-text"
          value={overlay.text}
          maxLength={MAX_OVERLAY_TEXT}
          onChange={(e) => set("text", e.target.value)}
          placeholder="NEW UPDATE!"
          aria-describedby="overlay-text-help"
        />
        <div id="overlay-text-help" className="flex flex-wrap gap-1.5 pt-1">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => set("text", s)}
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
          <p className="text-xs text-subtle">De tekst wordt precies zo op de afbeelding gezet als je hem typt.</p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
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
        <ColorField label="Tekstkleur" value={overlay.fillColor} onChange={(v) => set("fillColor", v)} />
        <ColorField label="Randkleur" value={overlay.outlineColor} onChange={(v) => set("outlineColor", v)} />
      </div>
    </div>
  );
}
