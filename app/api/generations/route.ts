import { NextResponse, type NextRequest } from "next/server";
import { VISUAL_STYLES, type VisualStyle } from "@/types/generation";
import { requireUser } from "@/lib/auth/session";
import { listCreations } from "@/lib/database/repo";
import { errorResponse } from "@/lib/http";

/** Gallery listing for the signed-in user only. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const sp = request.nextUrl.searchParams;
    const styleParam = sp.get("style");
    const style = VISUAL_STYLES.includes(styleParam as VisualStyle) ? (styleParam as VisualStyle) : undefined;
    const result = listCreations(user.id, {
      search: (sp.get("search") ?? "").slice(0, 200),
      style,
      favoritesOnly: sp.get("favorites") === "1",
      sort: sp.get("sort") === "oldest" ? "oldest" : "newest",
      limit: Number.parseInt(sp.get("limit") ?? "24", 10) || 24,
      offset: Number.parseInt(sp.get("offset") ?? "0", 10) || 0,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
