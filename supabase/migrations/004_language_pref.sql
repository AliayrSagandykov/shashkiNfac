-- Run after 003_daily_streak.sql.
-- Stores the user's preferred UI language so the choice persists across
-- devices instead of being inferred from the browser locale every time.

alter table public.profiles
  add column if not exists language text not null default 'en' check (language in ('en', 'ru'));
