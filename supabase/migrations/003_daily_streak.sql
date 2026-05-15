-- Run after 002_profile_personalization.sql.
-- Replaces the home-screen "streak" tile semantics: instead of consecutive
-- wins, we track a daily login streak that increments by 1 each calendar day
-- the user is active and resets to 1 if they miss a day.

alter table public.profiles
  add column if not exists daily_streak int not null default 0,
  add column if not exists best_daily_streak int not null default 0,
  add column if not exists last_active_on date;
