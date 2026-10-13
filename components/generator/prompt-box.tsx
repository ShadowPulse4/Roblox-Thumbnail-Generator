"use client";

import * as React from "react";
import { Loader2, RotateCcw, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { Tip } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

export const PROMPT_PLACEHOLDER =
  "Beschrijf je Roblox-thumbnail… bijv. Een boze gouden nuggetkoning die vecht tegen een gigantische lavadraak in een epische vulkaanarena, filmische belichting, ultragedetailleerde 3D Roblox-stijl.";

export function PromptBox({
  value,
  onChange,
  maxLength,
  error,
  disabled,
  onSubmit,
  onEnhance,
  enhancing,
  enhanceAvailable,
  originalPrompt,
  onRestoreOriginal,
  enhanceNote,
}: {
  value: string;
  onChange: (v: string) => void;
  maxLength: number;
  error: string | null;
  disabled: boolean;
  onSubmit: () => void;
  onEnhance: () => void;
  enhancing: boolean;
  enhanceAvailable: boolean;
  originalPrompt: string | null;
  onRestoreOriginal: () => void;
  enhanceNote: React.ReactNode;
}) {
  const ref = React.useRef<HTMLTextAreaElement>(null);
  const count = value.length;
  const over = count > maxLength;
  const near = !over && count > maxLength * 0.9;

  // Grow with the content, between 5 and ~14 lines.
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(Math.max(el.scrollHeight, 140), 340)}px`;
  }, [value]);

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit();
    }
  }

  return (
    <div>
      <label htmlFor="prompt" className="mb-2 block text-[15px] font-medium text-fg">
        Wat moet er op je thumbnail?
      </label>
      <div
        className={cn(
          "rounded-[var(--radius-panel)] border bg-bg-raised transition-colors focus-within:border-accent-line focus-within:ring-2 focus-within:ring-accent/25",
          error || over ? "border-danger/60" : "border-line hover:border-line-strong",
        )}
      >
        <textarea
          ref={ref}
          id="prompt"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={PROMPT_PLACEHOLDER}
          aria-invalid={Boolean(error) || over}
          aria-describedby="prompt-help prompt-error"
          disabled={enhancing}
          spellCheck
          className="block w-full resize-none bg-transparent px-4 pb-2 pt-3.5 text-[15px] leading-relaxed text-fg placeholder:text-subtle focus:outline-none focus-visible:outline-none disabled:opacity-60"
          style={{ minHeight: 140 }}
        />
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3">
          <div className="flex items-center gap-1.5">
            <Tip
              content={
                enhanceAvailable
                  ? "Claude herschrijft je idee tot een gedetailleerde beeldbeschrijving. Je kunt die daarna nog aanpassen."
                  : "Hiervoor is een Anthropic API-sleutel nodig (zie Instellingen)."
              }
            >
              <Button
                size="sm"
                variant="ghost"
                onClick={onEnhance}
                disabled={enhancing || disabled || value.trim().length < 3}
                aria-disabled={!enhanceAvailable}
                className="text-[#c9bcff] hover:text-white"
              >
                {enhancing ? <Loader2 className="animate-spin" /> : <Wand2 />}
                {enhancing ? "Prompt verbeteren…" : "Prompt verbeteren"}
              </Button>
            </Tip>
            {originalPrompt !== null ? (
              <Button size="sm" variant="ghost" onClick={onRestoreOriginal} disabled={enhancing}>
                <RotateCcw />
                Origineel terug
              </Button>
            ) : null}
          </div>
          <p
            id="prompt-help"
            className={cn("text-xs tabular-nums", over ? "text-danger" : near ? "text-warning" : "text-subtle")}
            aria-live="polite"
          >
            {count.toLocaleString("nl-NL")} / {maxLength.toLocaleString("nl-NL")}
            <span className="ml-3 hidden text-subtle sm:inline">Ctrl/⌘ + Enter om te genereren</span>
          </p>
        </div>
      </div>
      <div className="mt-2 space-y-2">
        <FieldError id="prompt-error">{error}</FieldError>
        {enhanceNote}
      </div>
    </div>
  );
}
