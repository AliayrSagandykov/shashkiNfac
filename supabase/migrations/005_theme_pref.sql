-- Run after 004_language_pref.sql.
-- Stores the user's preferred color theme so it survives device changes.

alter table public.profiles
  add column if not exists theme text not null default 'dark' check (theme in ('dark', 'light'));
