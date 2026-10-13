import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { getConfig } from "@/lib/config";

/**
 * Local file storage under DATA_DIR/images. Storage paths are relative and
 * never sent to the browser; images are served through /api/images/[id],
 * which checks ownership first.
 */

const SAFE_SEGMENT = /^[A-Za-z0-9_-]+$/;

function root() {
  return path.join(getConfig().dataDir, "images");
}

function resolveSafe(relPath: string): string {
  const base = root();
  const full = path.resolve(base, relPath);
  if (!full.startsWith(base + path.sep)) {
    throw new Error("Invalid storage path");
  }
  return full;
}

export async function saveImageFile(userId: string, imageId: string, data: Buffer, ext: string): Promise<string> {
  if (!SAFE_SEGMENT.test(userId) || !SAFE_SEGMENT.test(imageId) || !SAFE_SEGMENT.test(ext)) {
    throw new Error("Invalid storage segment");
  }
  const rel = `${userId}/${imageId}.${ext}`;
  const full = resolveSafe(rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return rel;
}

export async function readImageFile(relPath: string): Promise<Buffer> {
  return fs.readFile(resolveSafe(relPath));
}

export async function deleteImageFile(relPath: string): Promise<void> {
  await fs.rm(resolveSafe(relPath), { force: true });
}
