import type { Metadata } from "next";
import Link from "next/link";
import { Factory, Ghost, Gift, Hand, Megaphone, PawPrint, Sparkles, Square, Swords, Zap } from "lucide-react";
import { STYLE_PRESETS, getStyleDef, type StylePreset } from "@/lib/ai/styles";
import { buttonVariants } from "@/components/ui/button";
import { Badge, PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Stijlen ontdekken" };

const ICONS: Record<StylePreset["icon"], React.ElementType> = {
  swords: Swords,
  paw: PawPrint,
  hand: Hand,
  zap: Zap,
  factory: Factory,
  sparkles: Sparkles,
  ghost: Ghost,
  gift: Gift,
  square: Square,
  megaphone: Megaphone,
};

/** Original placeholder artwork: a lit "stage" in the preset's colors, clearly labeled as such. */
function PresetArt({ preset }: { preset: StylePreset }) {
  const Icon = ICONS[preset.icon];
  const [a, b] = preset.colors;
  return (
    <div
      className="relative overflow-hidden"
      style={{
        aspectRatio: preset.aspectRatio === "1:1" ? "16 / 9" : preset.aspectRatio.replace(":", " / "),
        background: `radial-gradient(120% 90% at 30% 20%, ${a}55, transparent 60%), radial-gradient(90% 90% at 85% 90%, ${b}66, transparent 65%), #17181d`,
      }}
    >
      <div className="stud-grid absolute inset-0 opacity-70" />
      <div className="absolute inset-x-[18%] bottom-[-35%] h-[70%] rounded-[50%] blur-2xl" style={{ background: `${a}40` }} />
      <div className="absolute inset-0 grid place-items-center">
        <div
          className="grid size-16 place-items-center rounded-2xl border border-white/15 backdrop-blur-sm"
          style={{ background: `linear-gradient(145deg, ${a}cc, ${b}cc)`, boxShadow: `0 10px 40px -10px ${a}` }}
        >
          <Icon className="size-8 text-white drop-shadow" aria-hidden />
        </div>
      </div>
      {preset.overlayText ? (
        <span
          className="absolute left-3 top-2.5 -rotate-3 font-[family-name:var(--font-display)] text-sm font-extrabold tracking-tight text-white"
          style={{ textShadow: `0 2px 0 ${b}, 0 0 10px #000a` }}
        >
          {preset.overlayText}
        </span>
      ) : null}
      <span className="absolute bottom-2 right-2 rounded-[6px] bg-black/55 px-1.5 py-0.5 text-[10.5px] text-white/75">Illustratie, geen AI-voorbeeld</span>
    </div>
  );
}

export default function StylesPage() {
  const categories = [...new Set(STYLE_PRESETS.map((p) => p.category))];
  return (
    <>
      <PageHeader
        title="Stijlen ontdekken"
        subtitle="Start vanuit een kant-en-klaar idee. Je kunt de prompt en instellingen daarna nog aanpassen."
      />
      <nav aria-label="Categorieën" className="-mx-1 mb-6 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {categories.map((c) => (
          <a
            key={c}
            href={`#${encodeURIComponent(c)}`}
            className="shrink-0 rounded-full border border-line px-3 py-1.5 text-[13px] text-muted hover:border-line-strong hover:text-fg"
          >
            {c}
          </a>
        ))}
      </nav>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STYLE_PRESETS.map((preset) => (
          <article
            key={preset.id}
            id={encodeURIComponent(preset.category)}
            className="flex scroll-mt-24 flex-col overflow-hidden rounded-[var(--radius-panel)] border border-line bg-panel"
          >
            <PresetArt preset={preset} />
            <div className="flex flex-1 flex-col gap-3 p-4">
              <div>
                <p className="text-xs text-subtle">{preset.category}</p>
                <h2 className="mt-0.5 text-lg font-semibold">{preset.name}</h2>
                <p className="mt-1 text-sm text-muted">{preset.description}</p>
              </div>
              <blockquote className="rounded-[var(--radius-control)] border border-line bg-bg-raised p-3 text-[13px] leading-relaxed text-muted">
                {preset.prompt}
              </blockquote>
              <div className="mt-auto flex flex-wrap items-center gap-1.5">
                <Badge>{getStyleDef(preset.style).label}</Badge>
                <Badge>{preset.aspectRatio}</Badge>
                {preset.overlayText ? <Badge tone="accent">Tekst: {preset.overlayText}</Badge> : null}
                <Link href={`/?preset=${preset.id}`} className={buttonVariants({ variant: "primary", size: "sm", className: "ml-auto" })}>
                  Stijl gebruiken
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
