# Assignment 4 — Build Plan

## Build Order

| Step | Feature | Why this order |
|------|---------|---------------|
| 1 | Weather history table + DB function | Foundation — worker and UI both depend on this data |
| 2 | Cron job (pg_cron cleanup) | Depends on history table existing |
| 3 | API route — city preview | UI-facing, independent of history |
| 4 | Supabase Edge Function — digest | Depends on history data being present to be interesting |
| 5 | Clerk webhook — auto-seed on signup | Depends on nothing, but best tested last |

---

## Feature Breakdown

### Already built

**Background worker** (`apps/worker/src/index.ts` → Railway)
- Runs on a 30s interval via `setInterval`
- Reads distinct cities from `user_cities` table (service role)
- Geocodes unknown cities via Open-Meteo geocoding API
- Upserts current weather into `weather_readings` (one row per city, conflict on `city`)
- Moving parts: `setInterval` → Open-Meteo geocoding API → Open-Meteo forecast API → Supabase `weather_readings`

**Realtime subscription** (`apps/web/app/weather-live.tsx` → browser)
- On mount, opens a Supabase Realtime channel on `weather_readings`
- Listens for `postgres_changes` (INSERT/UPDATE)
- Merges incoming rows into local React state
- Moving parts: Supabase Realtime (WebSocket) → browser React state → re-render

**City manager + server actions** (`apps/web/app/city-manager.tsx` + `app/actions.ts`)
- User types a city name and submits
- Client calls a Next.js Server Action (`addCity`)
- Server Action uses service role to write to `user_cities`
- `revalidatePath('/')` triggers a server re-render to reflect the new city
- Moving parts: Browser form → Next.js Server Action → Supabase `user_cities` → `revalidatePath` → server re-render → browser

---

### Step 1 — Weather history + DB function

**What the user sees:** Each weather card shows a "24h: 44°F – 67°F" stats line.

**What changes:**
- New table: `weather_history(id, city, temperature_f, humidity, wind_speed, weather_code, recorded_at)` — append-only, no unique constraint
- Worker also `INSERT`s into `weather_history` on every poll (in addition to upserting `weather_readings`)
- New Postgres function: `city_stats(p_city text)` returns `(min_f, max_f, avg_f)` by querying the last 24h of history
- Server component calls `supabase.rpc('city_stats', { p_city })` and passes stats as props to weather cards

**Moving parts:**
```
Worker (every 30s)
  → INSERT into weather_history
  → UPSERT into weather_readings

Browser page load
  → Next.js server component
    → supabase.rpc('city_stats') [per city]
      → Postgres function queries weather_history
    → Props passed to WeatherCard
  → Rendered HTML to browser
```

---

### Step 2 — Cron job (pg_cron)

**What the user sees:** Nothing. Pure housekeeping.

**What it does:** Keeps the `weather_history` table from growing forever. Every hour, a scheduled SQL job deletes rows older than 7 days.

**What changes:**
- Enable `pg_cron` extension in Supabase
- Schedule: `SELECT cron.schedule('cleanup-weather-history', '0 * * * *', $$DELETE FROM weather_history WHERE recorded_at < NOW() - INTERVAL '7 days'$$)`

**Moving parts:**
```
pg_cron scheduler (inside Postgres, every hour)
  → DELETE FROM weather_history WHERE recorded_at < NOW() - 7 days
```

---

### Step 3 — API route: city preview

**What the user sees:** While typing a city name in the "Add a city" box, a small preview card appears below showing the current weather for that city — before they've saved it.

**What changes:**
- New Next.js API route: `GET /api/weather/[city]`
- Route geocodes the city name → fetches Open-Meteo forecast → returns JSON
- `city-manager.tsx` debounces the input (500ms) and fetches the preview
- Preview card renders below the input

**Moving parts:**
```
Browser (user types)
  → debounce 500ms
  → GET /api/weather/{city}  (Next.js API route, edge runtime)
    → Open-Meteo geocoding API
    → Open-Meteo forecast API
  → JSON response
  → Preview card rendered in browser
```

---

### Step 4 — Supabase Edge Function: weather digest

**What the user sees:** A "Get Digest" button on the dashboard. Clicking it shows a 1–2 sentence plain-English summary like: *"Your coldest city is London at 48°F with rain. Los Angeles is warmest at 72°F and clear."*

**What changes:**
- New Supabase Edge Function (`supabase/functions/weather-digest/index.ts`) — TypeScript, Deno runtime, deployed to Supabase
- Accepts a JSON body `{ cities: string[] }`
- Queries `weather_readings` directly (service role, no Next.js involved)
- Formats and returns a digest string
- Browser calls the Edge Function URL directly with the user's city list
- "Get Digest" button + digest display added to the dashboard

**Moving parts:**
```
Browser (user clicks "Get Digest")
  → POST https://<project>.supabase.co/functions/v1/weather-digest
      body: { cities: ["Chicago", "Paris", ...] }
    [Supabase Edge Function — Deno, runs on Supabase infra]
      → SELECT from weather_readings WHERE city = ANY(cities)
    → returns { digest: "London is coldest at 48°F..." }
  → Displayed in browser
```

**Key point:** The Next.js server is not involved. The browser talks directly to Supabase infrastructure.

---

### Step 5 — Clerk webhook: auto-seed on signup

**What the user sees:** When they sign up for the first time, Chicago is already in their "My Cities" list without them having added it.

**What changes:**
- New Next.js API route: `POST /api/webhooks/clerk`
- Verifies Clerk webhook signature using `svix` package
- On `user.created` event: inserts Chicago into `user_cities` for the new user's Clerk ID
- In Clerk dashboard: configure webhook pointing to `https://<your-domain>/api/webhooks/clerk` for `user.created` event

**Moving parts:**
```
User signs up on Clerk
  → Clerk fires POST to https://<app>/api/webhooks/clerk
    [Next.js API route]
      → verifies svix signature
      → extracts userId from event payload
      → INSERT into user_cities (clerk_id=userId, city='Chicago')
  → Next time user loads the app, Chicago is already in their list
```

---

## All moving parts at a glance

```
Open-Meteo APIs ←→ Worker (Node.js, Railway)
                        ↓ upsert / insert
                  Supabase Postgres
                    ├── weather_readings  ←→ Supabase Realtime ←→ Browser
                    ├── weather_history   ←→ city_stats() [DB function]
                    ├── user_cities       ←→ Server Actions (Next.js)
                    └── pg_cron           (internal scheduler)

Browser
  ├── Next.js Server Component (initial load, stats)
  ├── Next.js API route /api/weather/[city] → Open-Meteo (preview)
  ├── Next.js API route /api/webhooks/clerk ← Clerk (signup)
  └── Supabase Edge Function /weather-digest (direct, no Next.js)

Clerk ──────────────────────────────────────────────────────────────
  ├── Auth (Clerk Provider, middleware/proxy)
  └── Webhook → /api/webhooks/clerk
```
