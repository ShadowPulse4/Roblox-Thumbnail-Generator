import type { Metadata } from "next";
import { Generator, type GeneratorInitial } from "@/components/generator/generator";
import { PageHeader } from "@/components/ui/misc";
import { HeaderStatus } from "@/components/layout/header-status";
import { STYLE_PRESETS } from "@/lib/ai/styles";
import { DEFAULT_OVERLAY } from "@/lib/overlay/layout";
import { getCurrentUser } from "@/lib/auth/session";
import { getGenerationForUser } from "@/lib/database/repo";

export const metadata: Metadata = { title: "Genereren" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GeneratePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const initial: GeneratorInitial = {};

  const presetId = one(sp.preset);
  const preset = presetId ? STYLE_PRESETS.find((p) => p.id === presetId) : undefined;
  if (preset) {
    initial.prompt = preset.prompt;
    initial.presetName = preset.name;
    initial.settings = {
      style: preset.style,
      aspectRatio: preset.aspectRatio,
      overlayEnabled: Boolean(preset.overlayText),
      overlay: { ...DEFAULT_OVERLAY, text: preset.overlayText ?? "" },
    };
  }

  // ?reuse=<generationId> puts an earlier prompt and its settings back in the form.
  const reuseId = one(sp.reuse);
  const generationId = one(sp.generation);
  if ((reuseId && UUID.test(reuseId)) || (generationId && UUID.test(generationId))) {
    const user = await getCurrentUser();
    if (user && reuseId && UUID.test(reuseId)) {
      const gen = getGenerationForUser(user.id, reuseId);
      if (gen) {
        initial.prompt = gen.enhancedPrompt ?? gen.prompt;
        initial.originalPrompt = gen.enhancedPrompt ? gen.prompt : null;
        initial.settings = {
          style: gen.visualStyle,
          aspectRatio: gen.aspectRatio,
          quality: gen.quality,
          overlayEnabled: Boolean(gen.overlay),
          ...(gen.overlay ? { overlay: gen.overlay } : {}),
        };
      }
    }
    if (user && generationId && UUID.test(generationId) && getGenerationForUser(user.id, generationId)) {
      initial.generationId = generationId;
    }
  }

  return (
    <>
      <PageHeader title="Roblox-thumbnails maken" subtitle="Zet je ideeën om in thumbnails waar spelers op klikken.">
        <HeaderStatus />
      </PageHeader>
      <Generator initial={initial} />
    </>
  );
}
