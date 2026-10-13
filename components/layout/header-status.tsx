"use client";

import Link from "next/link";
import { useAppStatus } from "./status-provider";
import { cn } from "@/lib/utils";

/** Current user and today's usage, from the server. Never a made-up balance. */
export function HeaderStatus() {
  const { status } = useAppStatus();
  const { limits, user, mode, image } = status;
  const left = limits.dailyImageLimit !== null ? Math.max(0, limits.dailyImageLimit - limits.imagesToday) : null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <span
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border px-3",
          image.configured ? "border-line text-muted" : "border-warning/40 text-warning",
        )}
      >
        <span className={cn("size-1.5 rounded-full", image.configured ? "bg-success" : "bg-warning")} aria-hidden />
        {image.configured ? image.model : "Geen beeldmodel"}
      </span>
      <Link
        href="/usage"
        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-muted hover:border-line-strong hover:text-fg"
      >
        {left !== null ? (
          <>
            <span className="tabular-nums text-fg">{left}</span> van {limits.dailyImageLimit} over vandaag
          </>
        ) : (
          <>
            <span className="tabular-nums text-fg">{limits.imagesToday}</span> gemaakt vandaag
          </>
        )}
      </Link>
      <span className="inline-flex h-8 items-center gap-2 rounded-full border border-line pl-1 pr-3 text-muted">
        <span className="grid size-6 place-items-center rounded-full bg-accent-soft text-[11px] font-semibold text-[#c9bcff]">
          {(user?.displayName ?? "?").slice(0, 1).toUpperCase()}
        </span>
        {mode === "local-open" ? "Lokaal" : user?.displayName}
      </span>
    </div>
  );
}
