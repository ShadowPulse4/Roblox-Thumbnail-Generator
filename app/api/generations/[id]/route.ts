import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { requireUser } from "@/lib/auth/session";
import { getGenerationForUser } from "@/lib/database/repo";
import { errorResponse } from "@/lib/http";
import { cleanupStaleGenerations } from "@/lib/services";

/** Polled by the generator while a generation is running. */
export async function GET(_request: NextRequest, ctx: RouteContext<"/api/generations/[id]">) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    cleanupStaleGenerations();
    const generation = getGenerationForUser(user.id, id);
    if (!generation) throw new AppError("not_found", "Deze generatie bestaat niet.");
    return NextResponse.json(generation, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
