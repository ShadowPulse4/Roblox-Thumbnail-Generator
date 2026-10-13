import { brand } from "./brand";

/** roblox-thumbnail-2026-10-13-1a2b3c.png — date first so files sort naturally. */
export function downloadFilename(date: Date, id: string, format = "png"): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const short = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6) || "image";
  const ext = /^[a-z0-9]+$/.test(format) ? format : "png";
  return `${brand.downloadPrefix}-${y}-${m}-${d}-${short}.${ext}`;
}
