"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Download,
  Heart,
  ImageOff,
  Images,
  Loader2,
  MoreHorizontal,
  PencilLine,
  RotateCcw,
  Search,
  SearchX,
  Shuffle,
  Trash2,
  Type,
} from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { toast } from "sonner";
import type { GeneratedImageDTO, GenerationDTO, VisualStyle } from "@/types/generation";
import { api, ApiError } from "@/lib/api-client";
import { getStyleDef, VISUAL_STYLE_DEFS } from "@/lib/ai/styles";
import { cn, formatDateTime } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Select, Segmented } from "@/components/ui/controls";
import { Badge, EmptyState, Skeleton } from "@/components/ui/misc";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EditImageDialog, Lightbox, OverlayDialog } from "@/components/generator/image-dialogs";
import { downloadImage, useFavorite } from "@/components/generator/result-card";

interface CreationItem {
  image: GeneratedImageDTO;
  generation: Omit<GenerationDTO, "images">;
}

const PAGE = 24;

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function CreationCard({
  item,
  onOpen,
  onDelete,
  onVariation,
  onEdit,
  onOverlay,
  onUnfavorite,
  busy,
}: {
  item: CreationItem;
  onOpen: () => void;
  onDelete: () => void;
  onVariation: () => void;
  onEdit: () => void;
  onOverlay: () => void;
  onUnfavorite?: () => void;
  busy: boolean;
}) {
  const [fav, toggleFav] = useFavorite(item.image);
  const { image, generation } = item;
  const alt = `Thumbnail: ${generation.prompt.slice(0, 120)}`;

  async function toggle() {
    await toggleFav();
    if (fav && onUnfavorite) onUnfavorite();
  }

  return (
    <article className="group flex flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel transition-colors hover:border-line-strong">
      <button
        type="button"
        onClick={onOpen}
        className="relative block bg-black/30"
        style={{ aspectRatio: "16 / 9" }}
        aria-label="Groot bekijken"
      >
        <Image src={image.url} alt={alt} fill unoptimized sizes="(max-width: 640px) 96vw, (max-width: 1280px) 45vw, 22vw" className="object-contain" />
        {busy ? (
          <span className="absolute inset-0 grid place-items-center bg-black/50">
            <Loader2 className="size-5 animate-spin" />
          </span>
        ) : null}
      </button>
      <div className="flex flex-1 flex-col gap-2.5 p-3">
        <p className="line-clamp-2 text-[13px] leading-snug text-fg" title={generation.prompt}>
          {generation.prompt}
        </p>
        <div className="flex flex-wrap gap-1">
          <Badge>{getStyleDef(generation.visualStyle).label}</Badge>
          <Badge>{generation.aspectRatio}</Badge>
          {image.overlay ? (
            <Badge tone="accent">
              <Type className="size-3" /> Met tekst
            </Badge>
          ) : null}
          {generation.kind !== "generate" ? <Badge>{generation.kind === "edit" ? "Bewerking" : "Variatie"}</Badge> : null}
        </div>
        <div className="mt-auto flex items-center justify-between gap-1 pt-1">
          <time className="text-xs text-subtle" dateTime={image.createdAt}>
            {formatDateTime(image.createdAt)}
          </time>
          <div className="flex items-center">
            <Button size="icon-sm" variant="ghost" onClick={toggle} aria-pressed={fav} aria-label={fav ? "Uit favorieten" : "Aan favorieten toevoegen"}>
              <Heart className={cn(fav && "fill-[#ff5c8a] text-[#ff5c8a]")} />
            </Button>
            <Button size="icon-sm" variant="ghost" onClick={() => downloadImage(image)} aria-label="Downloaden">
              <Download />
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Meer acties">
                <MoreHorizontal />
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={4}
                  className="z-50 min-w-48 rounded-[var(--radius-control)] border border-line-strong bg-panel-2 p-1 shadow-2xl shadow-black/50"
                >
                  {[
                    { label: "Prompt hergebruiken", icon: RotateCcw, href: `/?reuse=${generation.id}` },
                    { label: "Variatie maken", icon: Shuffle, onSelect: onVariation },
                    { label: "Afbeelding bewerken", icon: PencilLine, onSelect: onEdit },
                    { label: image.overlay ? "Tekst aanpassen" : "Tekst toevoegen", icon: Type, onSelect: onOverlay },
                  ].map(({ label, icon: Icon, href, onSelect }) =>
                    href ? (
                      <DropdownMenu.Item key={label} asChild>
                        <Link href={href} className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-chip)] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent-soft">
                          <Icon className="size-4 text-muted" /> {label}
                        </Link>
                      </DropdownMenu.Item>
                    ) : (
                      <DropdownMenu.Item
                        key={label}
                        onSelect={onSelect}
                        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-chip)] px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-accent-soft"
                      >
                        <Icon className="size-4 text-muted" /> {label}
                      </DropdownMenu.Item>
                    ),
                  )}
                  <DropdownMenu.Separator className="my-1 h-px bg-line" />
                  <DropdownMenu.Item
                    onSelect={onDelete}
                    className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-chip)] px-2.5 py-2 text-sm text-danger outline-none data-[highlighted]:bg-danger-soft"
                  >
                    <Trash2 className="size-4" /> Verwijderen
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Gallery({ favoritesOnly = false }: { favoritesOnly?: boolean }) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [style, setStyle] = React.useState<VisualStyle | "all">("all");
  const [sort, setSort] = React.useState<"newest" | "oldest">("newest");
  const [items, setItems] = React.useState<CreationItem[]>([]);
  const [total, setTotal] = React.useState(0);
  // `loadedKey` tells which query the current items belong to; while it differs
  // from the active query the grid shows skeletons.
  const [loadedKey, setLoadedKey] = React.useState<string | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<{ key: string; message: string } | null>(null);
  const [version, setVersion] = React.useState(0);
  const [lightbox, setLightbox] = React.useState<GeneratedImageDTO | null>(null);
  const [toDelete, setToDelete] = React.useState<CreationItem | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [editTarget, setEditTarget] = React.useState<GeneratedImageDTO | null>(null);
  const [overlayTarget, setOverlayTarget] = React.useState<CreationItem | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const debouncedSearch = useDebounced(search, 300);

  const params = React.useMemo(() => {
    const p = new URLSearchParams({ sort, limit: String(PAGE) });
    if (debouncedSearch.trim()) p.set("search", debouncedSearch.trim());
    if (style !== "all") p.set("style", style);
    if (favoritesOnly) p.set("favorites", "1");
    return p.toString();
  }, [debouncedSearch, style, sort, favoritesOnly]);
  const key = `${params}#${version}`;
  const loading = loadedKey !== key && error?.key !== key;

  const fetchPage = React.useCallback(
    (offset: number) => api<{ items: CreationItem[]; total: number }>(`/api/generations?${params}&offset=${offset}`),
    [params],
  );

  React.useEffect(() => {
    let alive = true;
    fetchPage(0)
      .then((res) => {
        if (!alive) return;
        setItems(res.items);
        setTotal(res.total);
        setLoadedKey(key);
      })
      .catch((e) => alive && setError({ key, message: e instanceof ApiError ? e.message : "Laden is mislukt." }));
    return () => {
      alive = false;
    };
  }, [fetchPage, key]);

  const reload = React.useCallback(() => setVersion((v) => v + 1), []);

  async function loadMore() {
    setLoadingMore(true);
    try {
      const res = await fetchPage(items.length);
      setItems((cur) => [...cur, ...res.items]);
      setTotal(res.total);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Laden is mislukt.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await api(`/api/images/${toDelete.image.id}`, { method: "DELETE" });
      setItems((cur) => cur.filter((i) => i.image.id !== toDelete.image.id));
      setTotal((t) => t - 1);
      toast.success("Afbeelding verwijderd.");
      setToDelete(null);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Verwijderen is mislukt.");
    } finally {
      setDeleting(false);
    }
  }

  async function variation(item: CreationItem) {
    setBusyId(item.image.id);
    try {
      const res = await api<{ generationId: string }>("/api/variations", {
        method: "POST",
        json: { imageId: item.image.id, count: 1, quality: item.generation.quality },
      });
      router.push(`/?generation=${res.generationId}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Variatie maken is mislukt.");
      setBusyId(null);
    }
  }

  const filtered = Boolean(debouncedSearch.trim()) || style !== "all";

  return (
    <div>
      <div className="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_220px]">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Zoek op prompt"
            aria-label="Zoek op prompt"
            className="pl-9"
          />
        </div>
        <Select
          label="Filter op stijl"
          value={style}
          onChange={setStyle}
          options={[{ value: "all" as const, label: "Alle stijlen" }, ...VISUAL_STYLE_DEFS.map((s) => ({ value: s.id, label: s.label }))]}
        />
        <Segmented
          size="sm"
          label="Sorteren"
          value={sort}
          onChange={setSort}
          className="h-10"
          options={[
            { value: "newest", label: "Nieuwste" },
            { value: "oldest", label: "Oudste" },
          ]}
        />
      </div>

      {error?.key === key ? (
        <EmptyState icon={<ImageOff />} title="Je creaties konden niet geladen worden" action={<Button onClick={reload}>Opnieuw proberen</Button>}>
          {error.message}
        </EmptyState>
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-busy="true" aria-label="Creaties laden">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel">
              <Skeleton className="aspect-video rounded-none" />
              <div className="space-y-2 p-3">
                <Skeleton className="h-4 w-11/12" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={<SearchX />}
            title="Niets gevonden"
            action={
              <Button
                onClick={() => {
                  setSearch("");
                  setStyle("all");
                }}
              >
                Filters wissen
              </Button>
            }
          >
            Geen {favoritesOnly ? "favorieten" : "creaties"} die passen bij je zoekopdracht of filter.
          </EmptyState>
        ) : favoritesOnly ? (
          <EmptyState
            icon={<Heart />}
            title="Nog geen favorieten"
            action={
              <Link href="/creations" className={buttonVariants({ variant: "secondary" })}>
                Naar mijn creaties
              </Link>
            }
          >
            Tik op het hartje bij een thumbnail om hem hier te bewaren.
          </EmptyState>
        ) : (
          <EmptyState
            icon={<Images />}
            title="Je hebt nog geen thumbnails gemaakt"
            action={
              <Link href="/" className={buttonVariants({ variant: "primary" })}>
                Eerste thumbnail maken
              </Link>
            }
          >
            Alles wat je genereert, bewerkt of van tekst voorziet, komt hier te staan.
          </EmptyState>
        )
      ) : (
        <>
          <p className="mb-3 text-sm text-muted" aria-live="polite">
            {total} {total === 1 ? "afbeelding" : "afbeeldingen"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {items.map((item) => (
              <CreationCard
                key={item.image.id}
                item={item}
                busy={busyId === item.image.id}
                onOpen={() => setLightbox(item.image)}
                onDelete={() => setToDelete(item)}
                onVariation={() => variation(item)}
                onEdit={() => setEditTarget(item.image)}
                onOverlay={() => setOverlayTarget(item)}
                onUnfavorite={favoritesOnly ? () => setItems((cur) => cur.filter((i) => i.image.id !== item.image.id)) : undefined}
              />
            ))}
          </div>
          {items.length < total ? (
            <div className="mt-6 flex justify-center">
              <Button onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? <Loader2 className="animate-spin" /> : null}
                Meer laden
              </Button>
            </div>
          ) : null}
        </>
      )}

      <Lightbox image={lightbox} alt="Thumbnail op volledige grootte" open={lightbox !== null} onOpenChange={(o) => !o && setLightbox(null)} />
      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title="Afbeelding verwijderen?"
        description="De afbeelding wordt definitief verwijderd. Dit kun je niet ongedaan maken."
        confirmLabel="Verwijderen"
        onConfirm={confirmDelete}
        busy={deleting}
      />
      <EditImageDialog
        image={editTarget}
        open={editTarget !== null}
        onOpenChange={(o) => !o && setEditTarget(null)}
        onStarted={(id) => router.push(`/?generation=${id}`)}
      />
      <OverlayDialog
        image={overlayTarget?.image ?? null}
        generation={overlayTarget?.generation ?? null}
        open={overlayTarget !== null}
        onOpenChange={(o) => !o && setOverlayTarget(null)}
        onDone={reload}
      />
    </div>
  );
}
