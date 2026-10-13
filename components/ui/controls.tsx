"use client";

import * as React from "react";
import { Select as SelectPrimitive, Slider as SliderPrimitive, Switch as SwitchPrimitive, ToggleGroup, Tooltip as TooltipPrimitive } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Switch ---------- */

export function Switch({ className, ...props }: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border border-line-strong bg-panel-2 transition-colors data-[state=checked]:border-accent data-[state=checked]:bg-accent disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4 translate-x-[2px] rounded-full bg-white shadow transition-transform data-[state=checked]:translate-x-[18px]" />
    </SwitchPrimitive.Root>
  );
}

/* ---------- Segmented control (single choice) ---------- */

export interface SegmentOption<T extends string> {
  value: T;
  label: React.ReactNode;
  hint?: string;
  disabled?: boolean;
  disabledReason?: string;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
  size = "md",
}: {
  value: T;
  onChange: (v: T) => void;
  options: SegmentOption<T>[];
  label: string;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <ToggleGroup.Root
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as T)}
      aria-label={label}
      className={cn("grid gap-1 rounded-[var(--radius-control)] border border-line bg-bg-raised p-1", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          title={o.disabled ? o.disabledReason : o.hint}
          className={cn(
            "flex flex-col items-center justify-center rounded-[var(--radius-chip)] px-2 text-center text-muted transition-colors hover:text-fg data-[state=on]:bg-panel-2 data-[state=on]:text-fg data-[state=on]:shadow-[inset_0_0_0_1px_var(--accent-line)] disabled:cursor-not-allowed disabled:opacity-40",
            size === "sm" ? "h-8 text-[13px]" : "min-h-10 py-1.5 text-sm",
          )}
        >
          <span className="font-medium">{o.label}</span>
          {o.hint && size === "md" ? <span className="text-[11px] leading-tight text-subtle">{o.hint}</span> : null}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  );
}

/* ---------- Select ---------- */

export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  id,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string; description?: string }[];
  label: string;
  id?: string;
  className?: string;
}) {
  const current = options.find((o) => o.value === value);
  return (
    <SelectPrimitive.Root value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectPrimitive.Trigger
        id={id}
        aria-label={label}
        className={cn(
          "flex h-10 w-full items-center justify-between gap-2 rounded-[var(--radius-control)] border border-line bg-bg-raised px-3 text-left text-sm text-fg transition-colors hover:border-line-strong data-[state=open]:border-accent-line",
          className,
        )}
      >
        <SelectPrimitive.Value>{current?.label}</SelectPrimitive.Value>
        <SelectPrimitive.Icon>
          <ChevronDown className="size-4 text-subtle" aria-hidden />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className="z-50 max-h-[min(380px,var(--radix-select-content-available-height))] w-[var(--radix-select-trigger-width)] min-w-56 overflow-hidden rounded-[var(--radius-control)] border border-line-strong bg-panel-2 shadow-2xl shadow-black/50"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none flex-col rounded-[var(--radius-chip)] py-2 pl-8 pr-3 text-sm text-fg outline-none data-[highlighted]:bg-accent-soft"
              >
                <SelectPrimitive.ItemIndicator className="absolute left-2.5 top-2.5">
                  <Check className="size-4 text-accent" aria-hidden />
                </SelectPrimitive.ItemIndicator>
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                {o.description ? <span className="text-xs text-subtle">{o.description}</span> : null}
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

/* ---------- Slider ---------- */

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
}) {
  return (
    <SliderPrimitive.Root
      value={[value]}
      onValueChange={([v]) => onChange(v)}
      min={min}
      max={max}
      step={step}
      className="relative flex h-5 w-full touch-none select-none items-center"
    >
      <SliderPrimitive.Track className="relative h-1 grow overflow-hidden rounded-full bg-line-strong">
        <SliderPrimitive.Range className="absolute h-full bg-accent" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb
        aria-label={label}
        className="block size-4 rounded-full border-2 border-accent bg-white shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
      />
    </SliderPrimitive.Root>
  );
}

/* ---------- Tooltip ---------- */

export function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <TooltipPrimitive.Provider delayDuration={250}>{children}</TooltipPrimitive.Provider>;
}

export function Tip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          sideOffset={6}
          className="z-50 max-w-64 rounded-[var(--radius-chip)] border border-line-strong bg-panel-2 px-2.5 py-1.5 text-xs text-fg shadow-xl"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
