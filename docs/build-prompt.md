# Claude Code prompt: Garmin dashboard, phase 1

Paste everything below the line into Claude Code in this repo. Ask it to show its plan before writing code.

---

You are building a private personal health dashboard in this repo. Read this whole brief first. Show me your plan and wait for my approval before writing code.

## Goal

A password-protected dashboard that works on my laptop and phone. It shows daily Garmin data and trends stored in Supabase. It runs as a Next.js app on Vercel, with a daily Python cron job that pulls Garmin data.

## Data sources

1. **Official Garmin Personal API (phase 1).** Use the Python package `garmin-connect-personal-api-python` (imports as `garmin_personal_api`). Auth: read a Personal API key from the env var `GARMIN_PERSONAL_API_KEY`, then exchange it for a bearer token with `PersonalApiAuthenticator().obtain_token(key)`. Pass the token to `GarminPersonalApiClient(bearer_token=...)`. Useful methods: `get_daily_sleep`, `get_daily_hrv`, `get_daily_body_battery`, `get_daily_heart_rate`, `get_daily_stress`, `get_fitness_age`, `search_activities`. Garmin does not offer VO2 max or training readiness through this API. Do not try.
2. **Mac script (phase 2, not now).** Readiness, VO2 max, training status, and race predictions will come from a script on my Mac. Do not build it in phase 1. Phase 2 comes later.

## Database (Supabase)

Schema `garmin` lives in an existing Supabase project that also holds finance data. Never touch the `public` schema. Use two Postgres connections:

- `GARMIN_WRITER_DB_URL`: role `garmin_writer`. Used by the cron only.
- `GARMIN_READER_DB_URL`: role `garmin_reader`. Used by the dashboard only. Read-only.

Tables (all exist already):

- `garmin.daily_official`: day (pk), sleep_seconds, sleep_score, hrv_last_night, hrv_weekly_avg, resting_hr, body_battery_charged, body_battery_drained, stress_overall, fitness_age, deep_seconds, light_seconds, rem_seconds, awake_seconds, synced_at
- `garmin.readiness_reading`: id, day, read_at, score, level, feedback, sleep_score, hrv_weekly_avg, synced_at. Unique on (day, read_at). Phase 2 fills this.
- `garmin.training_snapshot`: day (pk), vo2_max, vo2_max_precise, training_status, fitness_trend, acute_load, chronic_load, ctl, atl, tsb, load_ratio, synced_at. Phase 2 fills this.
- `garmin.race_prediction`: day, distance, seconds. Primary key (day, distance). Phase 2 fills this.
- `garmin.activity_load`: activity_id (pk), day, activity_type, duration_seconds, training_load, aerobic_effect, anaerobic_effect, synced_at
- `garmin.goal`: id (pk), label, distance, target_seconds, due_date. Two rows exist: `hanoi-marathon` (15600 s) and `half-marathon-april` (5400 s).
- `garmin.alert`: id, created_at, kind, message, resolved_at

## Phase 1 scope

### 1. Daily cron (Python, Vercel)

- Create `api/cron_garmin.py`, a Vercel Python function at `/api/cron_garmin`.
- Protect it: require header `Authorization: Bearer <CRON_SECRET>`.
- First run: backfill the last 90 days into `daily_official` (the Personal API accepts date ranges for daily summaries, sleep, HRV, body battery, and stress). Later runs: pull yesterday only.
- Upsert on `day`. Make the job idempotent: running it twice gives the same result.
- Then check the fitness drop rule. Compare `ctl` in `training_snapshot` today with the value 14 days ago. If it fell 10% or more and no unresolved alert of kind `fitness_drop` exists, insert one with a plain message. Phase 1 has no `training_snapshot` rows yet, so this check will do nothing until phase 2. Build it anyway, and test it with seeded data in a local test only.
- Schedule it daily at 07:00 Asia/Kuala_Lumpur using `vercel.json` cron. Vercel cron uses UTC, so write it as 23:00 UTC.

### 2. Login

- `/login` page with one password from `DASHBOARD_PASSWORD`.
- On success, set a signed, httpOnly cookie using `SESSION_SECRET`. Protect every page and `/api/*` route except `/login` and `/api/cron_garmin`.

### 3. Home page (`/`)

Follow `docs/design/E-home.dc.html`. It's a finished visual spec, so match its layout, colours, and type scale. Dark mode only.

- Verdict sentence, the four-step meter (rest, ease off, okay, strong), and the phrase for each state. For phase 1, the verdict is "awaiting readiness" until phase 2 supplies Garmin's readiness score. Do not compute my own readiness score.
- Fitness card: latest CTL and the 14-day change. Read `training_snapshot`. Phase 1 has no rows yet, so show "waiting for data" until phase 2.
- Tiles: sleep score, HRV, body battery charged and drained, resting HR, stress, and fitness age (secondary, smaller).
- "Sync now" button: call `/api/cron_garmin` with a manual trigger flag, then reload. Only lane A runs from the button.
- Show "last synced" time from `daily_official.synced_at`.

### 4. Trends page (`/trends`)

Follow `docs/design/F-trends.dc.html`.

- Dated fitness chart over 28 days by default, with a selector for 90 days. Label the peak and the low. Shade plateaus, which are periods where the value changes by less than 2% over 5 days.
- 14-day drop check: show a warning banner if an unresolved `fitness_drop` alert exists. Otherwise show "No drop. Fitness is up/down X%".
- Race projection: read the goal from `garmin.goal`. Show the latest `race_prediction` for the goal's distance. Half marathon is the default. The bar and gap turn red when behind target and green when on or ahead. Show the trend only when at least 14 days of predictions exist.
- VO2 max and load ratio tiles.

### 5. Code rules

- TypeScript for the Next.js app. Python only for the cron.
- Use `pg` (Node) for reads and `psycopg` (Python) for writes.
- Keep all secrets in environment variables. Add `.env.local` to `.gitignore`. Never log secret values.
- Write tests for the drop-warning rule and the plateau detection.
- Show me the file tree and each new env var name before you finish.
- Do not run `git push` yet. Commit locally and tell me the commit message.

## Environment variables (set in Vercel, names must match exactly)

- `GARMIN_PERSONAL_API_KEY`
- `GARMIN_WRITER_DB_URL`
- `GARMIN_READER_DB_URL`
- `CRON_SECRET`
- `DASHBOARD_PASSWORD`
- `SESSION_SECRET`

## Done when

- `/api/cron_garmin` backfills 90 days into `daily_official` on the first run.
- The dashboard loads on my phone behind the password.
- The drop-warning and plateau tests pass.
- Nothing from the `public` schema is read or written.
