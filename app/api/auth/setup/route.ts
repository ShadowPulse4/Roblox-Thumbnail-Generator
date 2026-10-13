import { NextResponse } from "next/server";
import { AppError } from "@/lib/ai/errors";
import { hashPassword } from "@/lib/auth/password";
import { startSession, toPublicUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { countAccountUsers, createUser } from "@/lib/database/repo";
import { errorResponse, parseJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { setupSchema } from "@/lib/validation/schemas";

/** Creates the first (admin) account. Only works while no accounts exist. */
export async function POST(request: Request) {
  try {
    if (getConfig().authMode !== "local") {
      throw new AppError("bad_request", "Accounts zijn uitgeschakeld (AUTH_MODE=none).");
    }
    checkRateLimit("setup", 10, 10 * 60_000);
    const body = await parseJson(request, setupSchema);
    const passwordHash = await hashPassword(body.password);
    // Check and create without an await in between, so two parallel requests
    // cannot both become the first admin.
    if (countAccountUsers() > 0) {
      throw new AppError("forbidden", "Er bestaat al een beheerder. Log in met dat account.");
    }
    const user = createUser({
      username: body.username,
      displayName: body.displayName,
      passwordHash,
      role: "admin",
      dailyImageLimit: null,
    });
    await startSession(user.id);
    return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
