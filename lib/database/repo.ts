import "server-only";
import { randomUUID } from "node:crypto";
import type {
  AspectRatio,
  GeneratedImageDTO,
  GenerationDTO,
  GenerationKind,
  GenerationStatus,
  PublicUser,
  QualityLevel,
  TextOverlay,
  VisualStyle,
} from "@/types/generation";
import { getDb, nowIso } from "./db";

/**
 * Data access layer. Every read or write of user content takes the acting
 * user's id and filters on it, so one user can never reach another user's
 * creations by guessing ids.
 */

// ---------- users ----------

interface UserRow {
  id: string;
  username: string;
  display_name: string;
  email: string | null;
  password_hash: string | null;
  role: "admin" | "member";
  daily_image_limit: number | null;
  created_at: string;
}

export interface UserRecord extends PublicUser {
  passwordHash: string | null;
  dailyImageLimit: number | null;
  createdAt: string;
}

function mapUser(r: UserRow): UserRecord {
  return {
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    passwordHash: r.password_hash,
    dailyImageLimit: r.daily_image_limit,
    createdAt: r.created_at,
  };
}

export const LOCAL_USER_ID = "local-user";

/** The single owner used when the app runs without accounts (AUTH_MODE=none). */
export function ensureLocalUser(): UserRecord {
  const db = getDb();
  db.prepare(
    `INSERT OR IGNORE INTO users (id, username, display_name, role, created_at) VALUES (?, 'lokaal', 'Lokale gebruiker', 'admin', ?)`,
  ).run(LOCAL_USER_ID, nowIso());
  return getUserById(LOCAL_USER_ID)!;
}

export function getUserById(id: string): UserRecord | null {
  const row = getDb().prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function getUserByUsername(username: string): UserRecord | null {
  const row = getDb().prepare(`SELECT * FROM users WHERE username = ?`).get(username) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function countAccountUsers(): number {
  const r = getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE id != ?`).get(LOCAL_USER_ID) as { n: number };
  return r.n;
}

export function listAccountUsers(): UserRecord[] {
  const rows = getDb().prepare(`SELECT * FROM users WHERE id != ? ORDER BY created_at`).all(LOCAL_USER_ID) as UserRow[];
  return rows.map(mapUser);
}

export function createUser(input: {
  username: string;
  displayName: string;
  passwordHash: string;
  role: "admin" | "member";
  dailyImageLimit: number | null;
}): UserRecord {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO users (id, username, display_name, password_hash, role, daily_image_limit, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(id, input.username, input.displayName, input.passwordHash, input.role, input.dailyImageLimit, nowIso());
  return getUserById(id)!;
}

export function updateUser(
  id: string,
  patch: { displayName?: string; passwordHash?: string; dailyImageLimit?: number | null; role?: "admin" | "member" },
) {
  const user = getUserById(id);
  if (!user) return null;
  getDb()
    .prepare(`UPDATE users SET display_name = ?, password_hash = ?, daily_image_limit = ?, role = ? WHERE id = ?`)
    .run(
      patch.displayName ?? user.displayName,
      patch.passwordHash ?? user.passwordHash,
      patch.dailyImageLimit === undefined ? user.dailyImageLimit : patch.dailyImageLimit,
      patch.role ?? user.role,
      id,
    );
  return getUserById(id);
}

export function deleteUser(id: string) {
  getDb().prepare(`DELETE FROM users WHERE id = ?`).run(id);
}

export function countAdmins(): number {
  const r = getDb().prepare(`SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND id != ?`).get(LOCAL_USER_ID) as {
    n: number;
  };
  return r.n;
}

// ---------- sessions ----------

export function createSessionRow(tokenHash: string, userId: string, expiresAt: Date) {
  getDb()
    .prepare(`INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`)
    .run(tokenHash, userId, expiresAt.toISOString(), nowIso());
}

export function getSessionUser(tokenHash: string): UserRecord | null {
  const row = getDb()
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?`,
    )
    .get(tokenHash, nowIso()) as UserRow | undefined;
  return row ? mapUser(row) : null;
}

export function deleteSession(tokenHash: string) {
  getDb().prepare(`DELETE FROM sessions WHERE token_hash = ?`).run(tokenHash);
}

export function deleteSessionsForUser(userId: string) {
  getDb().prepare(`DELETE FROM sessions WHERE user_id = ?`).run(userId);
}

export function purgeExpiredSessions() {
  getDb().prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(nowIso());
}

// ---------- generations & images ----------

interface GenerationRow {
  id: string;
  user_id: string;
  kind: GenerationKind;
  parent_image_id: string | null;
  prompt: string;
  enhanced_prompt: string | null;
  final_prompt: string;
  aspect_ratio: AspectRatio;
  visual_style: VisualStyle;
  quality: QualityLevel;
  provider_quality: string;
  image_count: number;
  image_provider: string;
  image_model: string;
  overlay_json: string | null;
  status: GenerationStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

interface ImageRow {
  id: string;
  generation_id: string;
  user_id: string;
  storage_path: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  parent_image_id: string | null;
  overlay_json: string | null;
  created_at: string;
  is_favorite?: number;
}

export interface ImageRecord {
  id: string;
  generationId: string;
  userId: string;
  storagePath: string;
  width: number;
  height: number;
  format: string;
  createdAt: string;
  parentImageId: string | null;
  hasOverlay: boolean;
}

function parseOverlay(json: string | null): TextOverlay | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as TextOverlay;
  } catch {
    return null;
  }
}

function imageDto(r: ImageRow): GeneratedImageDTO {
  return {
    id: r.id,
    generationId: r.generation_id,
    width: r.width,
    height: r.height,
    format: r.format,
    createdAt: r.created_at,
    isFavorite: Boolean(r.is_favorite),
    parentImageId: r.parent_image_id,
    overlay: parseOverlay(r.overlay_json),
    url: `/api/images/${r.id}`,
  };
}

function generationDto(r: GenerationRow, images: ImageRow[]): GenerationDTO {
  return {
    id: r.id,
    kind: r.kind,
    prompt: r.prompt,
    enhancedPrompt: r.enhanced_prompt,
    finalPrompt: r.final_prompt,
    aspectRatio: r.aspect_ratio,
    visualStyle: r.visual_style,
    quality: r.quality,
    imageCount: r.image_count,
    imageProvider: r.image_provider,
    imageModel: r.image_model,
    providerQuality: r.provider_quality,
    status: r.status,
    errorCode: r.error_code,
    errorMessage: r.error_message,
    parentImageId: r.parent_image_id,
    overlay: parseOverlay(r.overlay_json),
    createdAt: r.created_at,
    completedAt: r.completed_at,
    images: images.map(imageDto),
  };
}

export interface NewGeneration {
  userId: string;
  kind: GenerationKind;
  parentImageId: string | null;
  prompt: string;
  enhancedPrompt: string | null;
  finalPrompt: string;
  aspectRatio: AspectRatio;
  visualStyle: VisualStyle;
  quality: QualityLevel;
  providerQuality: string;
  imageCount: number;
  imageProvider: string;
  imageModel: string;
  overlay: TextOverlay | null;
}

export function createGeneration(g: NewGeneration): string {
  const id = randomUUID();
  getDb()
    .prepare(
      `INSERT INTO generations (id, user_id, kind, parent_image_id, prompt, enhanced_prompt, final_prompt, aspect_ratio, visual_style, quality, provider_quality, image_count, image_provider, image_model, overlay_json, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    )
    .run(
      id,
      g.userId,
      g.kind,
      g.parentImageId,
      g.prompt,
      g.enhancedPrompt,
      g.finalPrompt,
      g.aspectRatio,
      g.visualStyle,
      g.quality,
      g.providerQuality,
      g.imageCount,
      g.imageProvider,
      g.imageModel,
      g.overlay ? JSON.stringify(g.overlay) : null,
      nowIso(),
    );
  return id;
}

export function setGenerationStatus(
  id: string,
  status: GenerationStatus,
  error?: { code: string; message: string } | null,
) {
  const done = status === "succeeded" || status === "failed";
  getDb()
    .prepare(`UPDATE generations SET status = ?, error_code = ?, error_message = ?, completed_at = ? WHERE id = ?`)
    .run(status, error?.code ?? null, error?.message ?? null, done ? nowIso() : null, id);
}

/**
 * Generations left in pending/running after a server restart can never
 * finish, because the work ran inside the old process.
 */
export function failStaleGenerations(olderThanMs: number) {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString();
  getDb()
    .prepare(
      `UPDATE generations SET status = 'failed', error_code = 'interrupted', error_message = 'Deze generatie is onderbroken (de server is herstart of de tijdslimiet is verstreken). Er zijn geen kosten geregistreerd.', completed_at = ?
       WHERE status IN ('pending','running') AND created_at < ?`,
    )
    .run(nowIso(), cutoff);
}

export function insertImage(img: {
  id: string;
  generationId: string;
  userId: string;
  storagePath: string;
  width: number;
  height: number;
  format: string;
  bytes: number;
  parentImageId: string | null;
  overlay: TextOverlay | null;
}) {
  getDb()
    .prepare(
      `INSERT INTO generated_images (id, generation_id, user_id, storage_path, width, height, format, bytes, parent_image_id, overlay_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      img.id,
      img.generationId,
      img.userId,
      img.storagePath,
      img.width,
      img.height,
      img.format,
      img.bytes,
      img.parentImageId,
      img.overlay ? JSON.stringify(img.overlay) : null,
      nowIso(),
    );
}

const IMAGE_SELECT = `SELECT i.*, EXISTS(SELECT 1 FROM favorites f WHERE f.generated_image_id = i.id AND f.user_id = ?) AS is_favorite FROM generated_images i`;

export function getGenerationForUser(userId: string, id: string): GenerationDTO | null {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM generations WHERE id = ? AND user_id = ?`).get(id, userId) as
    | GenerationRow
    | undefined;
  if (!row) return null;
  const images = db
    .prepare(`${IMAGE_SELECT} WHERE i.generation_id = ? AND i.user_id = ? ORDER BY i.created_at`)
    .all(userId, id, userId) as ImageRow[];
  return generationDto(row, images);
}

export function getImageForUser(userId: string, imageId: string): ImageRecord | null {
  const r = getDb().prepare(`SELECT * FROM generated_images WHERE id = ? AND user_id = ?`).get(imageId, userId) as
    | ImageRow
    | undefined;
  if (!r) return null;
  return {
    id: r.id,
    generationId: r.generation_id,
    userId: r.user_id,
    storagePath: r.storage_path,
    width: r.width,
    height: r.height,
    format: r.format,
    createdAt: r.created_at,
    parentImageId: r.parent_image_id,
    hasOverlay: r.overlay_json !== null,
  };
}

export interface CreationQuery {
  search?: string;
  style?: VisualStyle;
  favoritesOnly?: boolean;
  sort?: "newest" | "oldest";
  limit?: number;
  offset?: number;
}

export interface CreationItem {
  image: GeneratedImageDTO;
  generation: Omit<GenerationDTO, "images">;
}

/** Gallery listing: one entry per image, joined with its generation. */
export function listCreations(userId: string, q: CreationQuery): { items: CreationItem[]; total: number } {
  const db = getDb();
  const where: string[] = ["i.user_id = ?"];
  const params: (string | number)[] = [userId];
  if (q.search?.trim()) {
    where.push(`(g.prompt LIKE ? ESCAPE '\\' OR IFNULL(g.enhanced_prompt,'') LIKE ? ESCAPE '\\')`);
    const like = `%${q.search.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    params.push(like, like);
  }
  if (q.style) {
    where.push("g.visual_style = ?");
    params.push(q.style);
  }
  if (q.favoritesOnly) {
    where.push("EXISTS(SELECT 1 FROM favorites f WHERE f.generated_image_id = i.id AND f.user_id = ?)");
    params.push(userId);
  }
  const whereSql = where.join(" AND ");
  const order = q.sort === "oldest" ? "ASC" : "DESC";
  const limit = Math.min(Math.max(q.limit ?? 24, 1), 100);
  const offset = Math.max(q.offset ?? 0, 0);

  const total = (
    db.prepare(`SELECT COUNT(*) AS n FROM generated_images i JOIN generations g ON g.id = i.generation_id WHERE ${whereSql}`).get(
      ...params,
    ) as { n: number }
  ).n;

  const rows = db
    .prepare(
      `SELECT i.*, EXISTS(SELECT 1 FROM favorites f WHERE f.generated_image_id = i.id AND f.user_id = ?) AS is_favorite,
              g.id AS g_id, g.kind AS g_kind, g.parent_image_id AS g_parent_image_id, g.prompt AS g_prompt, g.enhanced_prompt AS g_enhanced_prompt,
              g.final_prompt AS g_final_prompt, g.aspect_ratio AS g_aspect_ratio, g.visual_style AS g_visual_style, g.quality AS g_quality,
              g.provider_quality AS g_provider_quality, g.image_count AS g_image_count, g.image_provider AS g_image_provider,
              g.image_model AS g_image_model, g.overlay_json AS g_overlay_json, g.status AS g_status, g.error_code AS g_error_code,
              g.error_message AS g_error_message, g.created_at AS g_created_at, g.completed_at AS g_completed_at, g.user_id AS g_user_id
       FROM generated_images i JOIN generations g ON g.id = i.generation_id
       WHERE ${whereSql}
       ORDER BY i.created_at ${order}
       LIMIT ? OFFSET ?`,
    )
    .all(userId, ...params, limit, offset) as (ImageRow & Record<string, unknown>)[];

  const items = rows.map((r) => {
    const g: GenerationRow = {
      id: r.g_id as string,
      user_id: r.g_user_id as string,
      kind: r.g_kind as GenerationKind,
      parent_image_id: r.g_parent_image_id as string | null,
      prompt: r.g_prompt as string,
      enhanced_prompt: r.g_enhanced_prompt as string | null,
      final_prompt: r.g_final_prompt as string,
      aspect_ratio: r.g_aspect_ratio as AspectRatio,
      visual_style: r.g_visual_style as VisualStyle,
      quality: r.g_quality as QualityLevel,
      provider_quality: r.g_provider_quality as string,
      image_count: r.g_image_count as number,
      image_provider: r.g_image_provider as string,
      image_model: r.g_image_model as string,
      overlay_json: r.g_overlay_json as string | null,
      status: r.g_status as GenerationStatus,
      error_code: r.g_error_code as string | null,
      error_message: r.g_error_message as string | null,
      created_at: r.g_created_at as string,
      completed_at: r.g_completed_at as string | null,
    };
    const { images: _omit, ...generation } = generationDto(g, []);
    void _omit;
    return { image: imageDto(r), generation };
  });
  return { items, total };
}

/**
 * Deletes one image. When it was the last image of its generation the
 * generation row goes too. Returns the storage path so the caller can remove
 * the file, or null when the image does not belong to this user.
 */
export function deleteImageForUser(userId: string, imageId: string): string | null {
  const db = getDb();
  const img = getImageForUser(userId, imageId);
  if (!img) return null;
  db.transaction(() => {
    db.prepare(`DELETE FROM generated_images WHERE id = ? AND user_id = ?`).run(imageId, userId);
    const left = db.prepare(`SELECT COUNT(*) AS n FROM generated_images WHERE generation_id = ?`).get(img.generationId) as {
      n: number;
    };
    if (left.n === 0) {
      db.prepare(`DELETE FROM generations WHERE id = ? AND user_id = ?`).run(img.generationId, userId);
    }
  })();
  return img.storagePath;
}

export function setFavorite(userId: string, imageId: string, favorite: boolean): boolean {
  const db = getDb();
  if (!getImageForUser(userId, imageId)) return false;
  if (favorite) {
    db.prepare(`INSERT OR IGNORE INTO favorites (id, user_id, generated_image_id, created_at) VALUES (?, ?, ?, ?)`).run(
      randomUUID(),
      userId,
      imageId,
      nowIso(),
    );
  } else {
    db.prepare(`DELETE FROM favorites WHERE user_id = ? AND generated_image_id = ?`).run(userId, imageId);
  }
  return true;
}

export function countImagesSince(userId: string, sinceIso: string): number {
  // Counts images that were requested (pending/running included) so parallel
  // requests cannot slip past the daily limit.
  const r = getDb()
    .prepare(
      `SELECT IFNULL(SUM(CASE WHEN status = 'succeeded' THEN (SELECT COUNT(*) FROM generated_images i WHERE i.generation_id = g.id AND i.overlay_json IS NULL)
                              WHEN status IN ('pending','running') THEN image_count ELSE 0 END), 0) AS n
       FROM generations g WHERE user_id = ? AND created_at >= ?`,
    )
    .get(userId, sinceIso) as { n: number };
  return r.n;
}

export function countActiveGenerations(userId: string): number {
  const r = getDb()
    .prepare(`SELECT COUNT(*) AS n FROM generations WHERE user_id = ? AND status IN ('pending','running')`)
    .get(userId) as { n: number };
  return r.n;
}
