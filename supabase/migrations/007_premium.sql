-- Run after 006_games_and_analysis.sql.
-- Premium accounts (Stripe-backed) and daily analysis quota tracking.
--
-- We track:
--   is_premium          true while the user has an active premium plan
--   stripe_customer_id  Stripe Customer object, reused across checkouts
--   premium_since       when premium first started (informational)
--   premium_until       NULL = lifetime plan; otherwise current period end
--                       for monthly subs. Backend still checks this on every
--                       gated action so a missed webhook can't grant infinite
--                       access — if premium_until is in the past the user is
--                       treated as free until the next webhook re-confirms.
--   last_analysis_at    timestamp of the user's most recent NEW analysis
--                       run. Cached / repeat opens of an already-analysed
--                       game don't update this. The free tier allows 1
--                       analysis per rolling 24 hours.

alter table public.profiles
  add column if not exists is_premium boolean not null default false,
  add column if not exists stripe_customer_id text,
  add column if not exists premium_since timestamptz,
  add column if not exists premium_until timestamptz,
  add column if not exists last_analysis_at timestamptz;

create index if not exists profiles_stripe_customer_idx
  on public.profiles (stripe_customer_id)
  where stripe_customer_id is not null;

create index if not exists profiles_is_premium_idx
  on public.profiles (is_premium)
  where is_premium = true;
