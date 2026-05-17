# Checkers — платформа для международных шашек

Онлайн-платформа для игры в международные шашки (10×10) с движком,
матчмейкингом, рейтингом и полным разбором партий после игры.
React + TypeScript на фронте, Node + Socket.IO на бэке, Supabase
для авторизации и БД, Stripe для премиума.

- **Продакшен**: <https://shashki-nfac.vercel.app>
- **Бэкенд**: задеплоен на Render
- **БД / Auth**: Supabase (Postgres + Google OAuth)

---

## Что внутри

### Режимы игры

| Режим | Нужен логин | Онлайн | Движок | Рейтинг |
|---|---|---|---|---|
| Игра с ботом | Нет | Нет | Да | Нет |
| Игра с самим собой | Нет | Нет | Нет | Нет |
| Случайный соперник | Да | Да | Нет | Да |
| Игра против AI | Да | Нет | Да | Нет |

### Онлайн

- Реалтайм-матчмейкинг через Socket.IO. Игроки делятся по тайм-контролю,
  окно толерантности по Эло автоматически расширяется чем дольше ты в очереди.
- Валидация ходов на сервере: бэк сам генерирует список легальных ходов и
  сверяет полную последовательность взятий (`from`, `to` **и точные клетки
  взятых шашек**) — клиент не может подсунуть не-максимальное взятие.
- Тайм-контроли: `1+0`, `3+0`, `5+0`, `10+0` и без лимита.
  Флаг-фолл проверяется на сервере.
- Предложение ничьей, сдача, реванш (с переменой цвета), внутриигровой чат.
- Рейтинг Эло (K=32) обновляется после каждой рейтинговой партии.

### Движок

- Правила международных шашек (10×10):
  - Шашки и дамки ходят и бьют по диагонали; взятие обязательно.
  - **Максимальное взятие** — из нескольких возможных последовательностей
    легальны только те, что бьют больше всего шашек.
  - Дамка летает: длинные ходы и взятия по диагонали, приземляется в любую
    клетку за побитой шашкой.
  - Превращение в дамку только при остановке на последнем ряду
    (не посреди серии взятий).
- Поиск: негамакс + альфа-бета с правильными флагами границ
  (EXACT/LOWER/UPPER) в транспозиционной таблице.
- **Итеративное углубление**: каждый проход подсовывает следующему лучший
  ход из TT — альфа-бета режет гораздо больше веток, движок реально доходит
  до целевой глубины.
- Оценка: материал (шашка 100, дамка 300) плюс бонус за продвижение,
  штраф за крайние столбцы и небольшой бонус за защиту последнего ряда.

### Разбор партии

После игры можно прогнать движок по всем позициям. Результат:
- Per-move потеря в сантипешках + классификация
  (`best ≤25 · good ≤75 · inaccuracy ≤175 · mistake ≤400 · blunder >400`).
- Точность белых / чёрных в % по формуле Lichess: `100 · exp(−loss / 200)`.
- График оценки с курсором — клик переносит на нужный ход.
- Топ key moments — самые большие зевки.

Разборы кэшируются в Supabase: повторное открытие той же партии не запускает
анализ заново. Идёт **дедупликация in-flight** — если кто-то жмёт "Analyze"
параллельно, расчёт идёт один.

### Премиум

| | Free | Premium |
|---|---|---|
| Анализ новых партий | 1 в сутки | без лимита |
| Открытие уже проанализированных | без лимита | без лимита |
| Золотая рамка в лидерборде | — | да |
| Бейдж 👑 в профиле | — | да |

Два тарифа: $4.99/мес (подписка) или $39 (lifetime, один раз).
Платежи — через Stripe Checkout.

### Профиль и социалка

- Логин через Google (Supabase Auth).
- Профиль: рейтинг, W/L/D, последние партии, daily-стрик.
- Лидерборд топ-30.
- Страница новостей (markdown).

### Персонализация

- Языки: английский и русский (сохраняется per-user).
- Светлая / тёмная тема.
- Онбординг при первом логине.

---

## Стек

- **Фронт**: React 18 + TypeScript + Vite + TailwindCSS + Zustand + React Router. Реалтайм через `socket.io-client`.
- **Бэк**: Node 18+ + TypeScript + Express + Socket.IO. Платежи — `stripe` SDK.
- **БД / Auth**: Supabase (Postgres + RLS + Google OAuth). Миграции в `supabase/migrations/`.
- **Деплой**: Vercel (фронт) + Render (бэк).

---

## Запуск локально

### Что нужно
- Node 18+
- Аккаунт Supabase с включённым Google OAuth

### База данных

В Supabase SQL Editor применить миграции по порядку
(`001_…` → `007_…`):

| Файл | Что добавляет |
|---|---|
| `001_profiles.sql` | таблица `profiles` + триггер из `auth.users` |
| `002_profile_personalization.sql` | имя, аватар, био |
| `003_daily_streak.sql` | поля стрика |
| `004_language_pref.sql` | язык per-user |
| `005_theme_pref.sql` | тема per-user |
| `006_games_and_analysis.sql` | `match_history` + `match_analyses` |
| `007_premium.sql` | флаги премиума + stripe customer id + квота на анализ |

### Фронт

```bash
cd frontend
cp .env.example .env
# VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_BACKEND_URL
npm install
npm run dev          # http://localhost:5173
```

### Бэк

```bash
cd backend
cp .env.example .env
# PORT, FRONTEND_URL (без trailing slash!), SUPABASE_URL, SUPABASE_SERVICE_KEY
# STRIPE_* (опционально — без них billing-роуты вернут 503, остальное работает)
npm install
npm run dev          # http://localhost:3001
```

> **Про CORS**: `FRONTEND_URL` должен в точности совпадать с `Origin`
> браузера. Trailing slash ломает CORS (middleware его срезает,
> но лучше сразу без него). Несколько доменов — через запятую.

---

## Stripe (для премиума)

Если четырёх `STRIPE_*` переменных нет — billing-роуты молча возвращают
`503`, остальное приложение работает. Чтобы включить премиум полностью:

1. <https://dashboard.stripe.com> → регистрация, оставляем **Test mode**.
2. **Product catalog** → создать два продукта:
   - `Checkers Premium` — Recurring, $4.99 / month → скопировать `price_…` в `STRIPE_PRICE_MONTHLY`.
   - `Checkers Premium Lifetime` — One-time, $39 → скопировать `price_…` в `STRIPE_PRICE_LIFETIME`.
3. **Developers → API keys** → secret key (`sk_test_…`) → в `STRIPE_SECRET_KEY`.
4. **Developers → Webhooks → + Add endpoint**:
   - URL: `https://<your-backend>/api/billing/webhook`
   - События: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
   - Скопировать signing secret (`whsec_…`) в `STRIPE_WEBHOOK_SECRET`.
5. **Settings → Billing → Customer portal** → Activate (для отмены и смены карты).
6. На Render положить эти четыре переменные → автодеплой.

---

## Структура проекта

```
frontend/src/
  pages/         Login · Home · Game · Review · Profile · Leaderboard ·
                 News · Premium
  components/    Board · Piece · Clock · Timer · Avatar · ChatPanel · MoveList ·
                 EvalGraph · GameOverModal · OnboardingModal ·
                 LanguageToggle · ThemeToggle · Sidebar
  engine/        rules.ts (международные шашки) · ai.ts (минимакс + iterative deepening)
  store/         authStore · gameStore · profileStore   (Zustand)
  services/      supabase · socket · games · profile · billing
  i18n/          en + ru

backend/src/
  engine/        rules.ts        — серверная генерация легальных ходов
  game/          gameRoom.ts     — состояние комнаты, Эло, время
  handlers/      gameHandlers.ts — события сокета (make_move, resign, …)
                 timeoutWatcher  — флаг-фолл + сохранение партии
  matchmaking/   matchmaker.ts   — очередь, пары, расширение Эло-окна
  analysis/      analyzer.ts     — per-move оценка, классификация, точность
  api/           games.ts        — REST: recent / detail / analyze
                 billing.ts      — Stripe checkout · webhook · portal
  services/      supabase.ts     — клиент с service-role
                 stripe.ts       — ленивый клиент Stripe
  types/         game.ts         — TimeControl, GameRoom, QueueEntry

supabase/migrations/             — версионированные SQL миграции
```

---

## API

| Метод | Путь | Описание |
|---|---|---|
| `GET`  | `/health` | Healthcheck |
| `GET`  | `/api/games/recent?userId=…&limit=…` | Последние партии пользователя |
| `GET`  | `/api/games/:id` | Одна партия + сохранённый анализ (если есть) |
| `POST` | `/api/games/:id/analyze` | Запуск / выдача кэшированного анализа. `{ depth?, userId? }`. Free-юзерам сверх лимита — `402 quota_exceeded` + `nextAvailableAt`. |
| `POST` | `/api/billing/checkout` | `{ userId, plan: "monthly" \| "lifetime" }` → `{ url }` на Stripe Checkout |
| `POST` | `/api/billing/portal` | `{ userId }` → `{ url }` на Stripe Customer Portal |
| `POST` | `/api/billing/webhook` | Stripe → бэк. Сырой body, проверка подписи. |

### Сокет-события

**Клиент → сервер**: `join_queue`, `leave_queue`, `make_move`, `resign`,
`offer_draw`, `accept_draw`, `decline_draw`, `request_rematch`,
`decline_rematch`, `chat_message`.

**Сервер → клиент**: `queue_joined`, `match_found`, `game_start`,
`game_update`, `game_end`, `game_persisted`, `move_rejected`,
`draw_offered`, `draw_declined`, `rematch_requested`, `rematch_declined`,
`rematch_started`, `chat_message`.

---

## Как протестировать

Полный путь — чтоб увидеть все фичи:

1. **Залогиньтесь через Google OAuth** на <https://shashki-nfac.vercel.app>.
   После онбординга вам выставится стартовый рейтинг по выбранному уровню.
2. **Позовите друга** и сыграйте онлайн (`Play → Random Player`). Матчмейкинг
   найдёт пару быстрее, если у вас близкий рейтинг — если друг новый, выберите
   один и тот же тайм-контроль и подождите 10-15 секунд, окно толерантности
   расширится автоматически.
3. После окончания игры жмите **Analyze** в окне результата — увидите точность,
   график оценки, ключевые моменты и пометки `?!`, `?`, `??` на каждом ходу.

Если играть не с кем / нет времени:
- Зайдите на **Leaderboard** → откройте профиль игрока **Алияр Сагандыков**
  → посмотрите его **последние 2 партии** — там уже есть полный разбор, можно
  потыкать стрелочки, кликать по ходам в листе и по графику оценки.
- Заодно увидите как выглядит премиум — золотая рамка вокруг аватарки и
  корона рядом с ником.

Дальше:
- **Выйдите из аккаунта** и потыкайте как гость — играйте с ботом или сами
  с собой, чтобы понять разницу в правах.
- Поменяйте **тему** (☀/🌙 в сайдбаре) и **язык** (на странице профиля).
- Откройте уже проанализированную партию ещё раз — анализ выдастся мгновенно
  из кэша, квоту не съест.

Если хотите проверить **покупку премиума**:
1. Откройте **/premium** в сайдбаре → выберите тариф.
2. На странице Stripe Checkout введите тестовую карту:
   - **Номер**: `4242 4242 4242 4242`
   - **Срок**: любая будущая дата (например `12/34`)
   - **CVC**: любые 3 цифры
   - Имя / адрес / почта — что угодно
3. После оплаты редирект обратно на `/premium` — через пару секунд появится
   золотая плашка "Active". Зайдите в лидерборд / профиль — увидите бейдж.

Удачной игры!
