import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { requireUser } from "@/lib/auth/session";
import { setFavorite } from "@/lib/database/repo";
import { assertSameOrigin, errorResponse } from "@/lib/http";

async function handle(request: NextRequest, ctx: RouteContext<"/api/images/[id]/favorite">, favorite: boolean) {
  try {
    assertSameOrigin(request);
    const user = await requireUser();
    const { id } = await ctx.params;
    if (!setFavorite(user.id, id, favorite)) throw new AppError("not_found", "Afbeelding niet gevonden.");
    return NextResponse.json({ isFavorite: favorite });
  } catch (err) {
    return errorResponse(err);
  }
}

export function PUT(request: NextRequest, ctx: RouteContext<"/api/images/[id]/favorite">) {
  return handle(request, ctx, true);
}

export function DELETE(request: NextRequest, ctx: RouteContext<"/api/images/[id]/favorite">) {
  return handle(request, ctx, false);
}
