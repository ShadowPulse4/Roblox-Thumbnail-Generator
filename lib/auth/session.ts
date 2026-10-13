import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { AppError } from "@/lib/ai/errors";
import { getConfig } from "@/lib/config";
import {
  createSessionRow,
  deleteSession,
  ensureLocalUser,
  getSessionUser,
  purgeExpiredSessions,
  type UserRecord,
} from "@/lib/database/repo";
import type { PublicUser } from "@/types/generation";

export const SESSION_COOKIE = "ns_session";
const SESSION_DAYS = 30;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Creates a session and sets an httpOnly cookie. Only the token's hash is stored. */
export async function startSession(userId: string) {
  purgeExpiredSessions();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  createSessionRow(hashToken(token), userId, expires);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getConfig().cookieSecure,
    path: "/",
    expires,
  });
}

export async function endSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) deleteSession(hashToken(token));
  store.delete(SESSION_COOKIE);
}

/**
 * Returns the acting user. Without accounts (AUTH_MODE=none) everyone is the
 * single local owner; with accounts the session cookie must be valid.
 */
export async function getCurrentUser(): Promise<UserRecord | null> {
  const cfg = getConfig();
  if (cfg.authMode === "none") return ensureLocalUser();
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getSessionUser(hashToken(token));
}

export async function requireUser(): Promise<UserRecord> {
  const user = await getCurrentUser();
  if (!user) throw new AppError("unauthorized", "Log in om verder te gaan.");
  return user;
}

export async function requireAdmin(): Promise<UserRecord> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AppError("forbidden", "Alleen beheerders kunnen dit doen.");
  return user;
}

/**
 * Blocks paid AI calls on a production install that has no login, so a
 * public deployment can never spend your API credit for strangers.
 */
export function assertAiAllowed() {
  const cfg = getConfig();
  if (cfg.authMode === "none" && cfg.isProduction && !cfg.allowOpenAccess) {
    throw new AppError(
      "open_access_blocked",
      "Deze installatie draait zonder login in productie. Zet AUTH_MODE=local om accounts te gebruiken (of ALLOW_OPEN_ACCESS=true als alleen jij erbij kunt).",
    );
  }
}

export function toPublicUser(u: UserRecord): PublicUser {
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role };
}
