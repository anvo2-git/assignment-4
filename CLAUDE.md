# Assignment 4 — Weather Dashboard

## Architecture

```
Open-Meteo API (free, no key)
      |  every 30s
      v
  apps/worker  --upsert--> Supabase Postgres (weather_readings, user_cities)
                                   |
                            Supabase Realtime
                                   |
                           apps/web (Next.js)  <-- Clerk (auth)
                         live weather updates
```

## Monorepo Layout

```
assignment-4/
├── apps/
│   ├── web/      # Next.js 15 + Tailwind + Clerk + Supabase Realtime → Vercel
│   └── worker/   # Node.js polling script → Railway
├── package.json  # npm workspaces root
└── CLAUDE.md
```

## Services

### apps/web — Next.js Frontend (Vercel)

- Framework: Next.js App Router, TypeScript, Tailwind CSS
- Auth: Clerk (`clerkMiddleware` in `middleware.ts`, `<ClerkProvider>` in layout)
- Realtime: Supabase Realtime subscription on `weather_readings` table
- Personalisation: user's favourite cities stored in `user_cities` table keyed by Clerk user ID
- Env vars (Vercel dashboard):
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### apps/worker — Background Poller (Railway)

- Polls Open-Meteo every 30s for 5 default cities
- Upserts results into `weather_readings` (conflict on `city` column)
- Env vars (Railway dashboard):
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `POLL_INTERVAL_MS` (default 30000)

## Database (Supabase)

### Tables

```sql
-- latest weather per city (upserted by worker)
create table weather_readings (
  id           serial primary key,
  city         text not null unique,
  temperature_f numeric,
  humidity     int,
  wind_speed   numeric,
  weather_code int,
  recorded_at  timestamptz
);

-- user's saved cities
create table user_cities (
  id         serial primary key,
  clerk_id   text not null,
  city       text not null,
  unique (clerk_id, city)
);
```

### RLS

- `weather_readings`: public read, no public write (service role only)
- `user_cities`: users can only read/write their own rows (`clerk_id = requesting_user_id`)

## Dev

```bash
npm run dev:web     # http://localhost:3000
npm run dev:worker  # polls every 30s, logs to console
```

Create `apps/web/.env.local` and `apps/worker/.env` — never commit these.
