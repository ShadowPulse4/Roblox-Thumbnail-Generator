import { NextResponse } from "next/server";
import { z } from "zod";
import { AppError } from "@/lib/ai/errors";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { requireUser } from "@/lib/auth/session";
import { getConfig } from "@/lib/config";
import { updateUser } from "@/lib/database/repo";
import { errorResponse, parseJson } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { passwordSchema } from "@/lib/validation/schemas";

const schema = z.object({
  displayName: z.string().trim().min(1, "Vul een naam in.").max(60).optional(),
  currentPassword: z.string().max(200).optional(),
  newPassword: passwordSchema.optional(),
});

/** Lets a signed-in user change their own display name or password. */
export async function PATCH(request: Request) {
  try {
    if (getConfig().authMode !== "local") throw new AppError("bad_request", "Accounts zijn uitgeschakeld.");
    const user = await requireUser();
    const body = await parseJson(request, schema);
    let passwordHash: string | undefined;
    if (body.newPassword) {
      checkRateLimit(`pw:${user.id}`, 5, 10 * 60_000);
      if (!(await verifyPassword(body.currentPassword ?? "", user.passwordHash))) {
        throw new AppError("bad_request", "Je huidige wachtwoord klopt niet.");
      }
      passwordHash = await hashPassword(body.newPassword);
    }
    updateUser(user.id, { displayName: body.displayName, passwordHash });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
