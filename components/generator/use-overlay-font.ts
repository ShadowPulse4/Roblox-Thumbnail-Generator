"use client";

import * as React from "react";
import type { Font } from "opentype.js";
import type { OverlayFont, TextOverlay } from "@/types/generation";
import { OVERLAY_FONT_FILES, unsupportedCharacters } from "@/lib/overlay/layout";

const cache = new Map<OverlayFont, Promise<Font>>();

function load(font: OverlayFont): Promise<Font> {
  let p = cache.get(font);
  if (!p) {
    p = (async () => {
      const [{ parse }, res] = await Promise.all([
        import("opentype.js"),
        fetch(`/fonts/${OVERLAY_FONT_FILES[font]}`),
      ]);
      if (!res.ok) throw new Error("font");
      return parse(await res.arrayBuffer());
    })();
    p.catch(() => cache.delete(font));
    cache.set(font, p);
  }
  return p;
}

/** Loads the same font file the server uses, so the preview matches the final render. */
export function useOverlayFont(font: OverlayFont): Font | null {
  const [loaded, setLoaded] = React.useState<{ name: OverlayFont; font: Font } | null>(null);
  React.useEffect(() => {
    let alive = true;
    load(font)
      .then((f) => alive && setLoaded({ name: font, font: f }))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [font]);
  return loaded && loaded.name === font ? loaded.font : null;
}

/** Characters in the overlay text that the chosen font cannot draw. */
export function useMissingChars(overlay: TextOverlay | null): string[] {
  const font = useOverlayFont(overlay?.font ?? "luckiest-guy");
  const text = overlay?.text ?? "";
  return React.useMemo(() => (font && text ? unsupportedCharacters(font, text) : []), [font, text]);
}
