import "server-only";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { getConfig } from "@/lib/config";

/**
 * Local SQLite database (data/app.db). The schema mirrors
 * supabase/migrations/0001_init.sql so the data layer can move to Supabase
 * Postgres later without changing the rest of the app.
 */

const MIGRATIONS: string[] = [
  `
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    display_name TEXT NOT NULL,
    email TEXT,
    password_hash TEXT,
    role TEXT NOT NULL CHECK (role IN ('admin','member')),
    daily_image_limit INTEGER,
    created_at TEXT NOT NULL
  );

  CREATE TABLE sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX sessions_user_idx ON sessions(user_id);

  CREATE TABLE generations (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('generate','edit','variation')),
    parent_image_id TEXT,
    prompt TEXT NOT NULL,
    enhanced_prompt TEXT,
    final_prompt TEXT NOT NULL,
    aspect_ratio TEXT NOT NULL,
    visual_style TEXT NOT NULL,
    quality TEXT NOT NULL,
    provider_quality TEXT NOT NULL,
    image_count INTEGER NOT NULL,
    image_provider TEXT NOT NULL,
    image_model TEXT NOT NULL,
    overlay_json TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending','running','succeeded','failed')),
    error_code TEXT,
    error_message TEXT,
    created_at TEXT NOT NULL,
    completed_at TEXT
  );
  CREATE INDEX generations_user_created_idx ON generations(user_id, created_at DESC);
  CREATE INDEX generations_status_idx ON generations(status);

  CREATE TABLE generated_images (
    id TEXT PRIMARY KEY,
    generation_id TEXT NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    format TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    parent_image_id TEXT REFERENCES generated_images(id) ON DELETE SET NULL,
    overlay_json TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX images_generation_idx ON generated_images(generation_id);
  CREATE INDEX images_user_created_idx ON generated_images(user_id, created_at DESC);

  CREATE TABLE favorites (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    generated_image_id TEXT NOT NULL REFERENCES generated_images(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, generated_image_id)
  );

  CREATE TABLE usage_records (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    generation_id TEXT REFERENCES generations(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    operation TEXT NOT NULL,
    image_count INTEGER NOT NULL DEFAULT 0,
    input_tokens INTEGER,
    output_tokens INTEGER,
    estimated_cost_usd REAL,
    actual_cost_usd REAL,
    cost_status TEXT NOT NULL CHECK (cost_status IN ('estimated','confirmed','unknown')),
    metadata_json TEXT,
    created_at TEXT NOT NULL
  );
  CREATE INDEX usage_created_idx ON usage_records(created_at);
  CREATE INDEX usage_user_created_idx ON usage_records(user_id, created_at);
  `,
];

type GlobalWithDb = typeof globalThis & { __nuggetDb?: { file: string; db: Database.Database } };

function migrate(db: Database.Database) {
  const current = db.pragma("user_version", { simple: true }) as number;
  for (let v = current; v < MIGRATIONS.length; v++) {
    db.transaction(() => {
      db.exec(MIGRATIONS[v]);
      db.pragma(`user_version = ${v + 1}`);
    })();
  }
}

export function getDb(): Database.Database {
  const g = globalThis as GlobalWithDb;
  const file = path.join(getConfig().dataDir, "app.db");
  if (g.__nuggetDb && g.__nuggetDb.file === file) return g.__nuggetDb.db;
  if (g.__nuggetDb) g.__nuggetDb.db.close();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");
  migrate(db);
  g.__nuggetDb = { file, db };
  return db;
}

/** Used by tests to start from a clean database. */
export function closeDb() {
  const g = globalThis as GlobalWithDb;
  g.__nuggetDb?.db.close();
  g.__nuggetDb = undefined;
}

export function nowIso(): string {
  return new Date().toISOString();
}
