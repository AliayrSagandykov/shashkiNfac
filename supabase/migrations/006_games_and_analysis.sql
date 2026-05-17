-- Run after 005_theme_pref.sql.
-- Persisted game history + engine analysis cache + per-user analysis quota.

create extension if not exists "pgcrypto";

create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  played_at timestamptz not null default now(),
  white_id uuid references auth.users(id) on delete set null,
  black_id uuid references auth.users(id) on delete set null,
  white_name text,
  black_name text,
  white_rating int,
  black_rating int,
  white_rating_after int,
  black_rating_after int,
  time_control text,
  mode text not null default 'random' check (mode in ('random','bot','self')),
  winner text check (winner in ('white','black','draw')),
  end_reason text check (end_reason in ('no_moves','resign','timeout','draw_agreed')),
  moves jsonb not null
);

create index if not exists games_white_idx on public.games (white_id, played_at desc);
create index if not exists games_black_idx on public.games (black_id, played_at desc);

alter table public.games enable row level security;

drop policy if exists "games_select_all" on public.games;
create policy "games_select_all" on public.games for select using (true);
-- writes only via the service role (backend); no insert/update/delete policy
-- for end users by design.

create table if not exists public.game_analyses (
  game_id uuid primary key references public.games(id) on delete cascade,
  depth int not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.game_analyses enable row level security;

drop policy if exists "analyses_select_all" on public.game_analyses;
create policy "analyses_select_all" on public.game_analyses for select using (true);

-- Quota counter on profiles.
alter table public.profiles
  add column if not exists analyses_used int not null default 0;
