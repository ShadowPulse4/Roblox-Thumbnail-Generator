import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { requireUser } from "@/lib/auth/session";
import { deleteImageForUser, getImageForUser } from "@/lib/database/repo";
import { downloadFilename } from "@/lib/download";
import { assertSameOrigin, errorResponse } from "@/lib/http";
import { deleteImageFile, readImageFile } from "@/lib/storage/local";

/** Serves an image only to its owner. `?download=1` makes the browser save it. */
export async function GET(request: NextRequest, ctx: RouteContext<"/api/images/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const image = getImageForUser(user.id, id);
    if (!image) throw new AppError("not_found", "Afbeelding niet gevonden.");
    let data: Buffer;
    try {
      data = await readImageFile(image.storagePath);
    } catch {
      throw new AppError("not_found", "Het bestand van deze afbeelding ontbreekt.");
    }
    const download = request.nextUrl.searchParams.get("download") === "1";
    const headers: Record<string, string> = {
      "Content-Type": image.format === "png" ? "image/png" : `image/${image.format}`,
      "Content-Length": String(data.length),
      // Private: images are per-user and must never be cached by shared proxies.
      "Cache-Control": "private, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    };
    if (download) {
      const name = downloadFilename(new Date(image.createdAt), image.id, image.format);
      headers["Content-Disposition"] = `attachment; filename="${name}"`;
    }
    return new NextResponse(new Uint8Array(data), { headers });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/images/[id]">) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await ctx.params;
    const storagePath = deleteImageForUser(user.id, id);
    if (!storagePath) throw new AppError("not_found", "Afbeelding niet gevonden.");
    await deleteImageFile(storagePath).catch(() => undefined);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
