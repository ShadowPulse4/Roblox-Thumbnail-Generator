import { NextResponse } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { verifyPassword } from "@/lib/auth/password";
import { startSession, toPublicUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { getUserByUsername } from "@/lib/database/repo";
import { errorResponse, parseJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { loginSchema } from "@/lib/validation/schemas";

export async function POST(request: Request) {
  try {
    if (getConfig().authMode !== "local") {
      throw new AppError("bad_request", "Inloggen is uitgeschakeld (AUTH_MODE=none).");
    }
    const body = await parseJson(request, loginSchema);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
    // Slow down password guessing per IP and per account.
    checkRateLimit(`login-ip:${ip}`, 10, 10 * 60_000);
    checkRateLimit(`login-user:${body.username.toLowerCase()}`, 5, 10 * 60_000);

    const user = getUserByUsername(body.username);
    const ok = await verifyPassword(body.password, user?.passwordHash ?? null);
    if (!user || !ok) {
      throw new AppError("unauthorized", "Gebruikersnaam of wachtwoord klopt niet.");
    }
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) });
  } catch (err) {
    return errorResponse(err);
  }
}
