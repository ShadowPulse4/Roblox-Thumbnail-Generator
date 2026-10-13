"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import {
  BarChart3,
  Compass,
  Heart,
  Images,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { brand } from "@/lib/brand";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api-client";
import { TooltipProvider } from "@/components/ui/controls";
import { useAppStatus } from "./status-provider";

const NAV = [
  { href: "/", label: "Genereren", icon: Sparkles },
  { href: "/creations", label: "Mijn creaties", icon: Images },
  { href: "/favorites", label: "Favorieten", icon: Heart },
  { href: "/styles", label: "Stijlen ontdekken", icon: Compass },
  { href: "/usage", label: "Gebruik en kosten", icon: BarChart3 },
  { href: "/settings", label: "Instellingen", icon: Settings },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-[var(--radius-chip)] px-1 py-1" aria-label={`${brand.name}, naar Genereren`}>
      {/* A golden nugget made of three tilted bricks. */}
      <svg viewBox="0 0 32 32" className="size-8 shrink-0" aria-hidden>
        <rect x="3" y="11" width="18" height="15" rx="4" transform="rotate(-8 12 18)" fill="#7c5cff" />
        <rect x="11" y="6" width="17" height="14" rx="4" transform="rotate(10 19 13)" fill="#ffd23f" />
        <circle cx="17" cy="11" r="1.6" fill="#fff6c9" />
        <circle cx="22" cy="12.5" r="1.6" fill="#fff6c9" />
      </svg>
      {!collapsed && (
        <span className="font-[family-name:var(--font-display)] text-[17px] font-semibold leading-none tracking-tight">
          {brand.shortName}
        </span>
      )}
    </Link>
  );
}

function UsageBlock({ collapsed }: { collapsed?: boolean }) {
  const { status } = useAppStatus();
  const router = useRouter();
  const { limits, user, mode } = status;
  const limit = limits.dailyImageLimit;
  const pct = limit ? Math.min(100, (limits.imagesToday / limit) * 100) : 0;

  async function logout() {
    await api("/api/auth/logout", { method: "POST", json: {} }).catch(() => undefined);
    router.replace("/login");
    router.refresh();
  }

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2" title={`${limits.imagesToday} afbeeldingen vandaag`}>
        <div className="grid size-8 place-items-center rounded-full bg-panel-2 text-xs font-semibold text-muted">
          {(user?.displayName ?? "?").slice(0, 1).toUpperCase()}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[var(--radius-control)] border border-line bg-bg-raised p-3">
      <div className="flex items-center gap-2.5">
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-panel-2 text-xs font-semibold text-muted">
          {(user?.displayName ?? "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user?.displayName ?? "Niet ingelogd"}</p>
          <p className="truncate text-xs text-subtle">
            {mode === "local-open" ? "Lokale modus, geen login" : user?.role === "admin" ? "Beheerder" : "Lid"}
          </p>
        </div>
        {mode === "accounts" && user ? (
          <button
            type="button"
            onClick={logout}
            className="rounded-[var(--radius-chip)] p-1.5 text-subtle hover:bg-panel-2 hover:text-fg"
            aria-label="Uitloggen"
            title="Uitloggen"
          >
            <LogOut className="size-4" />
          </button>
        ) : null}
      </div>
      <div>
        <div className="flex items-baseline justify-between text-xs">
          <span className="text-muted">Vandaag gemaakt</span>
          <span className="tabular-nums text-fg">
            {limits.imagesToday}
            {limit !== null ? <span className="text-subtle"> / {limit}</span> : null}
          </span>
        </div>
        {limit !== null ? (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={limits.imagesToday} aria-label="Daglimiet">
            <div className={cn("h-full rounded-full", pct >= 100 ? "bg-danger" : "bg-accent")} style={{ width: `${pct}%` }} />
          </div>
        ) : (
          <p className="mt-1 text-[11.5px] text-subtle">Geen daglimiet, wel een uitgavenlimiet.</p>
        )}
      </div>
    </div>
  );
}

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hoofdmenu" className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "group relative flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm transition-colors",
              active ? "bg-panel-2 text-fg" : "text-muted hover:bg-panel-2/60 hover:text-fg",
              collapsed && "justify-center px-0",
            )}
          >
            {active ? <span className="absolute left-0 top-2 h-6 w-[3px] rounded-r-full bg-accent" aria-hidden /> : null}
            <Icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "")} aria-hidden />
            {!collapsed && <span>{label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

/* Sidebar state lives in localStorage; this tiny store keeps React in sync with it. */
const sidebarListeners = new Set<() => void>();
function subscribeSidebar(cb: () => void) {
  sidebarListeners.add(cb);
  return () => sidebarListeners.delete(cb);
}
function readSidebar(): boolean {
  try {
    return localStorage.getItem("ns.sidebar") === "collapsed";
  } catch {
    return false;
  }
}
function writeSidebar(collapsed: boolean) {
  try {
    localStorage.setItem("ns.sidebar", collapsed ? "collapsed" : "open");
  } catch {
    /* storage unavailable */
  }
  sidebarListeners.forEach((cb) => cb());
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const collapsed = React.useSyncExternalStore(subscribeSidebar, readSidebar, () => false);
  const [mobileOpen, setMobileOpen] = React.useState(false);

  function toggle() {
    writeSidebar(!collapsed);
  }

  return (
    <TooltipProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-accent focus:px-3 focus:py-2 focus:text-white">
        Naar de inhoud
      </a>
      <div className="flex min-h-dvh">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-bg/70 px-3 py-4 backdrop-blur lg:flex",
            collapsed ? "w-[68px]" : "w-[248px]",
          )}
        >
          <div className={cn("mb-6 flex items-center", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed && <Logo />}
            <button
              type="button"
              onClick={toggle}
              className="rounded-[var(--radius-chip)] p-1.5 text-subtle hover:bg-panel-2 hover:text-fg"
              aria-label={collapsed ? "Zijbalk uitklappen" : "Zijbalk inklappen"}
            >
              {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <PanelLeftClose className="size-[18px]" />}
            </button>
          </div>
          <NavList collapsed={collapsed} />
          <div className="mt-auto">
            <UsageBlock collapsed={collapsed} />
          </div>
        </aside>

        {/* Mobile top bar + slide-out menu */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur lg:hidden">
            <Logo />
            <DialogPrimitive.Root open={mobileOpen} onOpenChange={setMobileOpen}>
              <DialogPrimitive.Trigger className="rounded-[var(--radius-chip)] p-2 text-muted hover:bg-panel-2 hover:text-fg" aria-label="Menu openen">
                <Menu className="size-5" />
              </DialogPrimitive.Trigger>
              <DialogPrimitive.Portal>
                <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/60" />
                <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,86vw)] flex-col border-r border-line bg-bg px-3 py-4 shadow-2xl">
                  <DialogPrimitive.Title className="sr-only">Menu</DialogPrimitive.Title>
                  <DialogPrimitive.Description className="sr-only">Navigatie</DialogPrimitive.Description>
                  <div className="mb-6 flex items-center justify-between">
                    <Logo />
                    <DialogPrimitive.Close className="rounded-[var(--radius-chip)] p-1.5 text-muted hover:bg-panel-2" aria-label="Menu sluiten">
                      <X className="size-5" />
                    </DialogPrimitive.Close>
                  </div>
                  <NavList onNavigate={() => setMobileOpen(false)} />
                  <div className="mt-auto">
                    <UsageBlock />
                  </div>
                </DialogPrimitive.Content>
              </DialogPrimitive.Portal>
            </DialogPrimitive.Root>
          </div>

          <main id="main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-9">
            {children}
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
