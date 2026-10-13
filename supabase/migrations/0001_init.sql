-- Nugget Studio AI: Postgres schema for a later move to Supabase.
--
-- The app currently stores everything locally (SQLite in DATA_DIR/app.db, see
-- lib/database/db.ts). This file mirrors that schema for Supabase Postgres with
-- Row Level Security, so moving over only needs a new data-access adapter.
-- It is NOT used by the app yet.

create extension if not exists "pgcrypto";

-- Profiles extend auth.users (Supabase Auth owns email and passwords).
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text not null,
  role text not null default 'member' check (role in ('admin', 'member')),
  daily_image_limit integer check (daily_image_limit is null or daily_image_limit >= 0),
  created_at timestamptz not null default now()
);

create table public.generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('generate', 'edit', 'variation')),
  parent_image_id uuid,
  prompt text not null,
  enhanced_prompt text,
  final_prompt text not null,
  aspect_ratio text not null check (aspect_ratio in ('16:9', '1:1', '4:3', '9:16')),
  visual_style text not null,
  quality text not null,
  provider_quality text not null,
  image_count integer not null check (image_count between 1 and 10),
  image_provider text not null,
  image_model text not null,
  overlay jsonb,
  status text not null check (status in ('pending', 'running', 'succeeded', 'failed')),
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);
create index generations_user_created_idx on public.generations (user_id, created_at desc);
create index generations_status_idx on public.generations (status) where status in ('pending', 'running');

create table public.generated_images (
  id uuid primary key default gen_random_uuid(),
  generation_id uuid not null references public.generations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Path inside the private "thumbnails" storage bucket, e.g. <user_id>/<image_id>.png.
  -- Never store temporary provider URLs here.
  storage_path text not null,
  width integer not null,
  height integer not null,
  format text not null,
  bytes integer not null,
  parent_image_id uuid references public.generated_images(id) on delete set null,
  overlay jsonb,
  created_at timestamptz not null default now()
);
create index images_generation_idx on public.generated_images (generation_id);
create index images_user_created_idx on public.generated_images (user_id, created_at desc);

alter table public.generations
  add constraint generations_parent_image_fk foreign key (parent_image_id)
  references public.generated_images(id) on delete set null;

create table public.favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  generated_image_id uuid not null references public.generated_images(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_id, generated_image_id)
);

create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  generation_id uuid references public.generations(id) on delete set null,
  provider text not null,
  model text not null,
  operation text not null,
  image_count integer not null default 0,
  input_tokens integer,
  output_tokens integer,
  estimated_cost_usd numeric(12, 6),
  actual_cost_usd numeric(12, 6),
  cost_status text not null check (cost_status in ('estimated', 'confirmed', 'unknown')),
  metadata jsonb,
  created_at timestamptz not null default now()
);
create index usage_created_idx on public.usage_records (created_at);
create index usage_user_created_idx on public.usage_records (user_id, created_at);

-- ── Row Level Security ─────────────────────────────────────────
-- Users can read their own rows. All writes that cost money (generations,
-- usage) go through the server with the service role, never from the browser.
alter table public.profiles enable row level security;
alter table public.generations enable row level security;
alter table public.generated_images enable row level security;
alter table public.favorites enable row level security;
alter table public.usage_records enable row level security;

create policy "own profile" on public.profiles for select using (auth.uid() = id);
create policy "own generations" on public.generations for select using (auth.uid() = user_id);
create policy "own images" on public.generated_images for select using (auth.uid() = user_id);
create policy "delete own images" on public.generated_images for delete using (auth.uid() = user_id);
create policy "own favorites read" on public.favorites for select using (auth.uid() = user_id);
create policy "own favorites write" on public.favorites for insert
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.generated_images i where i.id = generated_image_id and i.user_id = auth.uid())
  );
create policy "own favorites delete" on public.favorites for delete using (auth.uid() = user_id);
create policy "own usage" on public.usage_records for select using (auth.uid() = user_id);

-- ── Storage ───────────────────────────────────────────────────
-- Private bucket; files live under <user_id>/... and are served via signed URLs
-- created on the server after an ownership check.
insert into storage.buckets (id, name, public) values ('thumbnails', 'thumbnails', false)
  on conflict (id) do nothing;

create policy "read own thumbnails" on storage.objects for select
  using (bucket_id = 'thumbnails' and (storage.foldername(name))[1] = auth.uid()::text);
