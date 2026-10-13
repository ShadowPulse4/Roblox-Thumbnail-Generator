"use client";

import * as React from "react";
import type { TextOverlay } from "@/types/generation";
import { buildOverlaySvg, unsupportedCharacters } from "@/lib/overlay/layout";
import { useOverlayFont } from "./use-overlay-font";

/**
 * Draws the overlay SVG on top of its parent (which must be `relative`).
 * Width/height are the real output pixels; the SVG scales with the box.
 */
export function OverlayPreview({
  overlay,
  width,
  height,
  onMissingChars,
}: {
  overlay: TextOverlay;
  width: number;
  height: number;
  onMissingChars?: (chars: string[]) => void;
}) {
  const font = useOverlayFont(overlay.font);
  const result = React.useMemo(() => {
    if (!font || !overlay.text.trim()) return null;
    const missing = unsupportedCharacters(font, overlay.text);
    const { svg } = buildOverlaySvg(font, overlay, width, height);
    return { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, missing };
  }, [font, overlay, width, height]);

  const missingKey = result?.missing.join("") ?? "";
  React.useEffect(() => {
    onMissingChars?.(missingKey ? [...missingKey] : []);
  }, [missingKey, onMissingChars]);

  if (!result) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={result.url} alt="" aria-hidden className="pointer-events-none absolute inset-0 size-full select-none" draggable={false} />
  );
}
