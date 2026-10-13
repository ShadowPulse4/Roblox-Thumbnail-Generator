import { NextResponse } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { hashPassword } from "@/lib/auth/password";
import { requireAdmin } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { createUser, getUserByUsername, listAccountUsers } from "@/lib/database/repo";
import { errorResponse, parseJson } from "@/lib/http";
import { dailyImageLimitFor } from "@/lib/usage/limits";
import { createUserSchema } from "@/lib/validation/schemas";

function assertAccountsEnabled() {
  if (getConfig().authMode !== "local") {
    throw new AppError("bad_request", "Accounts zijn uitgeschakeld. Zet AUTH_MODE=local in .env.local om vrienden toe te voegen.");
  }
}

export async function GET() {
  try {
    assertAccountsEnabled();
    await requireAdmin();
    const cfg = getConfig();
    const users = listAccountUsers().map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      role: u.role,
      dailyImageLimit: u.dailyImageLimit,
      effectiveDailyImageLimit: dailyImageLimitFor(u, cfg),
      createdAt: u.createdAt,
    }));
    return NextResponse.json({ users });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    assertAccountsEnabled();
    await requireAdmin();
    const body = await parseJson(request, createUserSchema);
    const passwordHash = await hashPassword(body.password);
    if (getUserByUsername(body.username)) {
      throw new AppError("bad_request", "Deze gebruikersnaam is al in gebruik.");
    }
    const user = createUser({
      username: body.username,
      displayName: body.displayName,
      passwordHash,
      role: body.role,
      dailyImageLimit: body.dailyImageLimit,
    });
    return NextResponse.json({ user: { id: user.id, username: user.username } }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
