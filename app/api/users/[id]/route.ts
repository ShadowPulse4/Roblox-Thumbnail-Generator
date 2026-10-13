import { NextResponse, type NextRequest } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { countAdmins, deleteSessionsForUser, deleteUser, getUserById, LOCAL_USER_ID, updateUser } from "@/lib/database/repo";
import { assertSameOrigin, errorResponse, parseJson } from "@/lib/http";
import { updateUserSchema } from "@/lib/validation/schemas";

async function target(ctx: RouteContext<"/api/users/[id]">) {
  if (getConfig().authMode !== "local") throw new AppError("bad_request", "Accounts zijn uitgeschakeld.");
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const user = id === LOCAL_USER_ID ? null : getUserById(id);
  if (!user) throw new AppError("not_found", "Gebruiker niet gevonden.");
  return { admin, user };
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    const { admin, user } = await target(ctx);
    const body = await parseJson(request, updateUserSchema);
    if (body.role === "member" && user.role === "admin" && countAdmins() <= 1) {
      throw new AppError("bad_request", "Er moet minstens één beheerder overblijven.");
    }
    if (body.role === "member" && user.id === admin.id) {
      throw new AppError("bad_request", "Je kunt je eigen beheerdersrol niet weghalen.");
    }
    updateUser(user.id, {
      displayName: body.displayName,
      role: body.role,
      dailyImageLimit: body.dailyImageLimit,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    });
    // A new password signs the user out everywhere.
    if (body.password && user.id !== admin.id) deleteSessionsForUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: NextRequest, ctx: RouteContext<"/api/users/[id]">) {
  try {
    assertSameOrigin(request);
    const { admin, user } = await target(ctx);
    if (user.id === admin.id) throw new AppError("bad_request", "Je kunt je eigen account niet verwijderen.");
    // Their images are removed from the database via ON DELETE CASCADE; files
    // stay on disk under data/images/<id> so nothing is lost by accident.
    deleteUser(user.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
