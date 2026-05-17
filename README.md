# Checkers Platform

International draughts (10×10) platform with online play, a built-in
engine, and full game review. React + TypeScript on the front, Node +
Socket.IO on the back, Supabase for auth, persistence, and Postgres.

Live frontend: <https://shashki-nfac.vercel.app>
Backend: hosted on Render

## Features

### Game modes

| Mode               | Auth needed | Online | Engine | Rated |
|--------------------|-------------|--------|--------|-------|
| Play vs Bot        | No          | No     | Yes    | No    |
| Play Yourself      | No          | No     | No     | No    |
| Play Random Player | Yes         | Yes    | No     | Yes   |
| Play vs AI         | Yes         | No     | Yes    | No    |

### Online play
- Realtime matchmaking via Socket.IO. Players are bucketed by time
  control, with an Elo-tolerance window that widens the longer you wait.
- Server-authoritative move validation. The server independently
  generates the legal-move list and verifies the full capture sequence
  (`from`, `to`, **and** the exact captured squares) — clients can't
  cheat by sending a non-maximum capture.
- Time controls: `1+0`, `3+0`, `5+0`, `10+0`, and unlimited.
  Server-side flag-fall via `timeoutWatcher`.
- Draw offers, resign, rematch (with side-swap), in-game chat.
- Elo ratings (K=32) updated on every rated game.

### Engine
- 10×10 international draughts rules:
  - Men move and capture diagonally; capturing is mandatory.
  - **Maximum capture rule** enforced — if multiple capture sequences
    exist, only the ones taking the most pieces are legal.
  - Flying kings: long-range diagonal moves and captures, with the
    standard "land anywhere past the captured piece" rule.
  - Promotion only on landing on the back rank (not mid-capture).
- Search:
  - Negamax + alpha-beta with proper EXACT/LOWER/UPPER bound flags
    in the transposition table.
  - **Iterative deepening** with TT-move ordering — each shallower
    pass seeds the next pass's best move so alpha-beta prunes hard.
  - Material eval (man 100, king 300) plus advancement bonus, edge
    penalty for side-file men, and back-rank guard bonus.
- Bot difficulty levels (1-25) configurable from the Home screen.

### Game review
- POST-game analysis runs the engine on every position and reports:
  - Per-move loss in centipawns and a Lichess-style classification:
    `best ≤25 · good ≤75 · inaccuracy ≤175 · mistake ≤400 · blunder >400`.
  - White / Black accuracy %, using `100 · exp(-loss / 200)` averaged
    across each side's moves.
  - Eval graph (white-POV cp, clamped to ±2000) with a click-to-seek
    cursor.
  - Top key moments (blunders and mistakes, biggest first).
- Analyses are persisted in Supabase keyed by `match_id` — re-opening
  a previously analysed game shows the saved analysis instantly.
- Per-user in-flight dedup so concurrent "Analyze" clicks on the same
  game share a single run instead of multiplying load.
- Overall wall-clock budget (75 s) with shrinking per-ply time as the
  deadline approaches — the endpoint always returns *something* before
  the platform's HTTP timeout.

### Profile & social
- Google OAuth via Supabase.
- Profile page with rating, W/L/D, recent games, and daily streak.
- Leaderboard.
- News page (markdown-rendered).

### Personalization
- i18n: English and Russian (preference persisted per user).
- Light / dark theme toggle.
- Onboarding modal on first login.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS + Zustand +
  React Router. Realtime via `socket.io-client`.
- **Backend**: Node 18+ + TypeScript + Express + Socket.IO.
- **Database / Auth**: Supabase (Postgres + Row-Level-Security + Google
  OAuth). Migrations in `supabase/migrations/`.
- **Deploy**: Vercel (frontend) + Render (backend).

## Getting started

### Prerequisites
- Node 18+
- A Supabase project with Google OAuth enabled

### Database
Apply the SQL in `supabase/migrations/` in order (`001_…` → `007_…`)
in the Supabase SQL editor. They set up:

| File | Adds |
|------|------|
| `001_profiles.sql` | `profiles` table + trigger that mirrors `auth.users` |
| `002_profile_personalization.sql` | Display name, avatar, bio |
| `003_daily_streak.sql` | Streak fields |
| `004_language_pref.sql` | Per-user language |
| `005_theme_pref.sql` | Per-user theme |
| `006_games_and_analysis.sql` | `match_history` + `match_analyses` |
| `007_premium.sql` | Premium flags + Stripe customer id + analysis quota stamp |

### Frontend

```bash
cd frontend
cp .env.example .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL
npm install
npm run dev          # http://localhost:5173
```

### Backend

```bash
cd backend
cp .env.example .env
# PORT, FRONTEND_URL (no trailing slash), SUPABASE_URL, SUPABASE_SERVICE_KEY
npm install
npm run dev          # http://localhost:3001
```

> **CORS note**: `FRONTEND_URL` must match the browser's `Origin`
> exactly. A trailing slash will break CORS (the cors middleware
> strips it defensively, but cleaner to omit). Multiple origins
> can be passed comma-separated.

## Premium / Stripe setup

Premium adds: unlimited engine analyses (free tier is 1 per rolling
24 h), a golden frame on the leaderboard, and a Premium badge on the
profile. Two plans are offered: monthly subscription and one-time
lifetime.

If the four `STRIPE_*` env vars below aren't set, the billing routes
return `503` and the rest of the app continues to work — free-tier
quota still applies, just nobody can upgrade.

### 1. Create the Stripe account

1. Sign up at <https://dashboard.stripe.com>.
2. Stay in **Test mode** (top-right toggle) while developing — test-mode
   card `4242 4242 4242 4242` with any future date + any CVC works.

### 2. Create the products / prices

In the Stripe dashboard → **Products** → **+ Add product**:

**Product 1: Checkers Premium (Monthly)**
- Name: `Checkers Premium`
- Pricing: **Recurring · $4.99 / month** (pick any currency/price you like)
- Save → copy the **Price ID** (`price_…`) into `STRIPE_PRICE_MONTHLY`.

**Product 2: Checkers Premium Lifetime**
- Name: `Checkers Premium Lifetime`
- Pricing: **One-time · $39**
- Save → copy the **Price ID** into `STRIPE_PRICE_LIFETIME`.

### 3. Grab the secret key

Developers → **API keys** → reveal **Secret key** (`sk_test_…`) → copy
into `STRIPE_SECRET_KEY`.

### 4. Set up the webhook

The backend needs Stripe to call `POST /api/billing/webhook` when a
checkout completes / subscription changes.

**Production**: Developers → **Webhooks** → **+ Add endpoint** →
endpoint URL `https://<your-backend>/api/billing/webhook`. Pick events:
`checkout.session.completed`, `customer.subscription.updated`,
`customer.subscription.deleted`. Save → copy the **Signing secret**
(`whsec_…`) into `STRIPE_WEBHOOK_SECRET`.

**Local dev**: install the Stripe CLI and run

```bash
stripe login
stripe listen --forward-to localhost:3001/api/billing/webhook
```

The CLI prints a `whsec_…` for you — use that as `STRIPE_WEBHOOK_SECRET`
locally. Trigger a test event with `stripe trigger checkout.session.completed`.

### 5. Configure the Customer Portal

Settings → **Billing** → **Customer portal** → enable it and pick which
actions users can take (cancel, update payment method, etc.). No env var
needed; the backend's `/api/billing/portal` endpoint uses it directly.

### 6. Final env

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_LIFETIME=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Restart the backend and visit `/premium` in the frontend — both plans
should be live.

## Project structure

```
frontend/src/
  pages/         Login · Home · Game · Review · Profile · Leaderboard ·
                 News · Premium
  components/    Board · Piece · Clock · Timer · Avatar · ChatPanel · MoveList ·
                 EvalGraph · GameOverModal · OnboardingModal ·
                 LanguageToggle · ThemeToggle · Sidebar
  engine/        rules.ts (international draughts) · ai.ts (minimax + ID)
  store/         authStore · gameStore · profileStore   (Zustand)
  services/      supabase · socket · games · profile · billing
  i18n/          en + ru

backend/src/
  engine/        rules.ts        — server-authoritative move generator
  game/          gameRoom.ts     — room state, Elo calc, time accounting
  handlers/      gameHandlers.ts — socket events (make_move, resign, …)
                 timeoutWatcher  — flag-fall + game persistence
  matchmaking/   matchmaker.ts   — queue, pairing, Elo-tolerance widen
  analysis/      analyzer.ts     — per-move eval, classification, accuracy
  api/           games.ts        — REST: recent / detail / analyze
                 billing.ts      — Stripe checkout · webhook · portal
  services/      supabase.ts     — service-role client
                 stripe.ts       — lazy Stripe client + config
  types/         game.ts         — TimeControl, GameRoom, QueueEntry

supabase/migrations/             — versioned SQL migrations
```

## API

| Method | Path | Notes |
|--------|------|-------|
| `GET`  | `/health` | Liveness probe |
| `GET`  | `/api/games/recent?userId=…&limit=…` | Recent matches for a user |
| `GET`  | `/api/games/:id` | Single game + saved analysis (if any) |
| `POST` | `/api/games/:id/analyze` | Run / fetch cached analysis. Body: `{ depth?, userId? }`. Returns `402 { error: "quota_exceeded", nextAvailableAt }` for free users over the daily limit. |
| `POST` | `/api/billing/checkout` | Body: `{ userId, plan: "monthly" \| "lifetime" }`. Returns `{ url }` to redirect to Stripe Checkout. |
| `POST` | `/api/billing/portal` | Body: `{ userId }`. Returns `{ url }` to Stripe Customer Portal (cancel / update card). |
| `POST` | `/api/billing/webhook` | Stripe → backend. Raw-body, signature-verified. Handles `checkout.session.completed`, `customer.subscription.{updated,deleted}`. |

## Socket events

**Client → server**: `join_queue`, `leave_queue`, `make_move`,
`resign`, `offer_draw`, `accept_draw`, `decline_draw`,
`request_rematch`, `decline_rematch`, `chat_message`.

**Server → client**: `queue_joined`, `match_found`, `game_start`,
`game_update`, `game_end`, `game_persisted`, `move_rejected`,
`draw_offered`, `draw_declined`, `rematch_requested`,
`rematch_declined`, `rematch_started`, `chat_message`.
