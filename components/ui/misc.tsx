import * as React from "react";
import { cn } from "@/lib/utils";

export function Panel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-[var(--radius-panel)] border border-line bg-panel/90 shadow-[0_1px_0_rgb(255_255_255/0.03)_inset]", className)}
      {...props}
    />
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-[var(--radius-control)] bg-panel-2", className)} />;
}

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
  children: React.ReactNode;
}) {
  const tones = {
    neutral: "border-line-strong text-muted",
    accent: "border-accent-line bg-accent-soft text-[#c9bcff]",
    success: "border-success/40 bg-success/10 text-success",
    warning: "border-warning/40 bg-warning-soft text-warning",
    danger: "border-danger/40 bg-danger-soft text-danger",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-[var(--radius-chip)] border px-1.5 py-0.5 text-[11.5px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}

/** Explains what to do next when there is nothing to show, or something is not set up. */
export function Notice({
  tone = "neutral",
  icon,
  title,
  children,
  action,
  className,
}: {
  tone?: "neutral" | "warning" | "danger" | "accent";
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "border-line bg-panel",
    warning: "border-warning/35 bg-warning-soft",
    danger: "border-danger/35 bg-danger-soft",
    accent: "border-accent-line bg-accent-soft",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn("flex gap-3 rounded-[var(--radius-control)] border p-3.5 text-sm", tones[tone], className)}>
      {icon ? <div className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</div> : null}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-fg">{title}</p>
        {children ? <div className="mt-1 text-muted">{children}</div> : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="stud-grid flex flex-col items-center justify-center rounded-[var(--radius-panel)] border border-dashed border-line-strong px-6 py-16 text-center">
      <div className="mb-4 grid size-12 place-items-center rounded-full border border-line-strong bg-panel text-muted [&_svg]:size-5">{icon}</div>
      <h2 className="text-lg font-semibold">{title}</h2>
      {children ? <p className="mt-1.5 max-w-md text-sm text-muted">{children}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[28px] font-semibold leading-tight sm:text-[32px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-[15px] text-muted">{subtitle}</p> : null}
      </div>
      {children}
    </div>
  );
}
