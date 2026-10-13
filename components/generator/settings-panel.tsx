"use client";

import * as React from "react";
import { Type } from "lucide-react";
import type { AspectRatio, ImageCount, ProviderCapabilitiesDTO, QualityLevel, TextOverlay, VisualStyle } from "@/types/generation";
import { ASPECT_RATIO_DEFS, VISUAL_STYLE_DEFS } from "@/lib/ai/styles";
import { Label } from "@/components/ui/field";
import { Segmented, Select, Switch } from "@/components/ui/controls";
import { OverlayControls } from "./overlay-controls";

const QUALITY_LABELS: Record<QualityLevel, string> = { standard: "Standaard", high: "Hoog", ultra: "Ultra" };

export interface GeneratorSettings {
  aspectRatio: AspectRatio;
  style: VisualStyle;
  quality: QualityLevel;
  count: ImageCount;
  overlayEnabled: boolean;
  overlay: TextOverlay;
}

function RatioIcon({ ratio }: { ratio: AspectRatio }) {
  const [w, h] = ratio.split(":").map(Number);
  const scale = 14 / Math.max(w, h);
  return (
    <span className="mb-0.5 grid h-4 place-items-center" aria-hidden>
      <span className="block rounded-[2px] border-[1.5px] border-current" style={{ width: w * scale, height: h * scale }} />
    </span>
  );
}

export function SettingsPanel({
  settings,
  onChange,
  capabilities,
  maxImages,
  missingChars,
}: {
  settings: GeneratorSettings;
  onChange: (s: GeneratorSettings) => void;
  capabilities: ProviderCapabilitiesDTO | null;
  maxImages: number;
  missingChars: string[];
}) {
  const set = <K extends keyof GeneratorSettings>(key: K, v: GeneratorSettings[K]) => onChange({ ...settings, [key]: v });
  const qualityMap = capabilities?.quality ?? { standard: "medium", high: "high" };
  const limit = Math.min(maxImages, capabilities?.maxImagesPerRequest ?? maxImages);
  const styleDef = VISUAL_STYLE_DEFS.find((s) => s.id === settings.style);

  return (
    <div className="space-y-5">
      <div className="space-y-1.5">
        <Label>Beeldverhouding</Label>
        <Segmented
          label="Beeldverhouding"
          value={settings.aspectRatio}
          onChange={(v) => set("aspectRatio", v)}
          options={ASPECT_RATIO_DEFS.map((r) => ({
            value: r.id,
            label: (
              <span className="flex flex-col items-center">
                <RatioIcon ratio={r.id} />
                {r.label}
              </span>
            ),
            hint: r.hint,
          }))}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="style">Stijl</Label>
          <Select
            id="style"
            label="Stijl"
            value={settings.style}
            onChange={(v) => set("style", v)}
            options={VISUAL_STYLE_DEFS.map((s) => ({ value: s.id, label: s.label, description: s.description }))}
          />
          {styleDef ? <p className="text-xs text-subtle">{styleDef.description}</p> : null}
        </div>
        <div className="space-y-1.5">
          <Label>Aantal</Label>
          <Segmented
            size="sm"
            label="Aantal afbeeldingen"
            value={String(settings.count) as "1" | "2" | "4"}
            onChange={(v) => set("count", Number(v) as ImageCount)}
            options={(["1", "2", "4"] as const).map((n) => ({
              value: n,
              label: n,
              disabled: Number(n) > limit,
              disabledReason: `Maximaal ${limit} per keer`,
            }))}
          />
          <p className="text-xs text-subtle">Elke afbeelding telt apart mee voor je kosten.</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Kwaliteit</Label>
        <Segmented
          size="sm"
          label="Kwaliteit"
          value={settings.quality}
          onChange={(v) => set("quality", v)}
          options={(["standard", "high", "ultra"] as const).map((q) => ({
            value: q,
            label: QUALITY_LABELS[q],
            disabled: !qualityMap[q],
            disabledReason: "Het ingestelde beeldmodel heeft deze stand niet",
          }))}
        />
        <p className="text-xs text-subtle">
          {qualityMap[settings.quality]
            ? `Wordt doorgegeven als quality="${qualityMap[settings.quality]}". Hogere kwaliteit duurt langer en kost meer.`
            : "Kies een kwaliteit die dit model ondersteunt."}
        </p>
      </div>

      <div className="rounded-[var(--radius-control)] border border-line bg-bg-raised/60 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Type className="size-4 text-muted" aria-hidden />
            <div>
              <label htmlFor="overlay-toggle" className="text-sm font-medium">
                Tekst op de thumbnail
              </label>
              <p className="text-xs text-subtle">Wordt er na het genereren scherp op gezet, zonder spelfouten.</p>
            </div>
          </div>
          <Switch id="overlay-toggle" checked={settings.overlayEnabled} onCheckedChange={(v) => set("overlayEnabled", v)} />
        </div>
        {settings.overlayEnabled ? (
          <div className="mt-4 border-t border-line pt-4">
            <OverlayControls overlay={settings.overlay} onChange={(o) => set("overlay", o)} missingChars={missingChars} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
