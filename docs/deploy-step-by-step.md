# OIDashboard Deployment Guide (Beginner, Step-by-Step)

This guide deploys:
- `web` (Next.js UI + API)
- `worker` (cron jobs + Playwright)
- `Supabase` (Postgres + Auth)

Use this once your code is ready and migrations `001` to `013` are prepared.

## 1. Prepare Accounts

1. Create/login Supabase account: `https://supabase.com`
2. Create/login Railway account: `https://railway.app`
3. Keep your repo in GitHub (Railway deploys from GitHub).

## 2. Create Supabase Project

1. In Supabase, click `New project`.
2. Name it (example: `oidashboard-prod`).
3. Wait until project is ready.
4. Open `Project Settings` -> `API`.
5. Copy these values:
   - `Project URL` -> `SUPABASE_URL`
   - `Publishable key` -> `SUPABASE_PUBLISHABLE_KEY`
   - `Secret key` -> `SUPABASE_SECRET_KEY`

## 3. Run SQL Migrations (Supabase)

1. Open `SQL Editor`.
2. Run each file in order (copy/paste file content):
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_rls_policies.sql`
   - `supabase/migrations/003_retention_functions.sql`
   - `supabase/migrations/004_webhook_replay_guard.sql`
   - `supabase/migrations/005_webhook_request_log.sql`
   - `supabase/migrations/006_cme_expiration_and_top_actives.sql`
   - `supabase/migrations/007_cme_dte_decimal.sql`
   - `supabase/migrations/008_job_idempotency_keys.sql`
   - `supabase/migrations/009_cme_change_analytics.sql`
   - `supabase/migrations/010_cme_change_rls.sql`
   - `supabase/migrations/011_cme_delta_previous_times.sql`
   - `supabase/migrations/012_backfill_cme_delta_previous_times.sql`
   - `supabase/migrations/013_auth_login_lockouts.sql`

## 4. Create First Admin User

1. In Supabase, go `Authentication` -> `Users`.
2. Create/sign in one user (email or OAuth).
3. Get this user `UUID` from Users table.
4. In SQL Editor, run:

```sql
insert into public.user_roles (user_id, role)
values ('<USER_UUID>', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

## 5. Create Railway Project and Services

1. In Railway, click `New Project`.
2. Choose `Deploy from GitHub repo`.
3. Connect this repo.
4. Create two services:
   - service A name: `web`
   - service B name: `worker`

## 6. Configure `web` Service (Railway)

In `web` service, set:
- Root Directory: repo root (default)
- Build Command:
`npm run build -w @oid/web`
- Start Command:
`npm run start -w @oid/web`

Set environment variables in `web` service:

Minimal required:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `TRADINGVIEW_WEBHOOK_SECRET`
- `WORKER_CONTROL_SECRET=<same value as worker>`
- `WORKER_CONTROL_URL=<worker internal URL>`
- `WEBHOOK_REQUIRE_SIGNATURE=false` (for direct TradingView alerts)
- `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=true` (accept `secret` in JSON body)

Optional tuning (safe to skip; defaults exist in code):
- `WEBHOOK_MAX_SKEW_SECONDS=600`
- `WEBHOOK_REPLAY_TTL_MINUTES=120`
- `WEBHOOK_RATE_LIMIT_PER_MINUTE=180`
- `WEBHOOK_MAX_BODY_BYTES=16384`
- `RUN_NOW_COOLDOWN_SECONDS=20`
- `CME_LINK_UPDATE_COOLDOWN_SECONDS=20`
- `AUTH_SESSION_RATE_LIMIT_PER_MINUTE=30`
- `AUTH_LOGIN_RATE_LIMIT_PER_MINUTE=15`
- `ADMIN_API_RATE_LIMIT_PER_MINUTE=60`
- `AUTH_LOGIN_MAX_FAILED_ATTEMPTS=5`
- `AUTH_LOGIN_LOCK_MINUTES=15`
- `NEXT_PUBLIC_APP_NAME=OIDashboard`

Important:
- `WORKER_CONTROL_SECRET` must match worker exactly.
- `WORKER_CONTROL_URL` should point to worker service URL + port.
- Webhook auth modes:
  - Direct TradingView (current setup): `WEBHOOK_REQUIRE_SIGNATURE=false`, `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=true`
  - Strict HMAC mode (only if your sender can set `x-tv-signature`): `WEBHOOK_REQUIRE_SIGNATURE=true`, `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=false`

## 7. Configure `worker` Service (Railway)

In `worker` service, set:
- Root Directory: repo root (default)
- Recommended for Playwright stability:
  - Use Dockerfile deploy with `apps/worker/Dockerfile`
  - Leave Build/Start commands empty when using Dockerfile
- If not using Dockerfile:
  - Build Command: `npm run build -w @oid/worker`
  - Start Command: `npm run start -w @oid/worker`

Set environment variables in `worker` service:

Minimal required:
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `WORKER_CONTROL_SECRET=<same value as web>`

Optional tuning (safe to skip; defaults exist in code):
- `WORKER_CONTROL_PORT=4100`
- `WORKER_CRON_RELATION=*/30 * * * *`
- `WORKER_CRON_CME=*/30 * * * *`
- `WORKER_RETENTION_CRON=15 6 * * *`
- `CME_TIMEOUT_MS=45000`
- `CME_HEADLESS=true`
- `CME_REQUIRE_POSITIVE_DTE=true`
- `CME_EXTRACT_MAX_ATTEMPTS=3`
- `CME_EXTRACT_RETRY_DELAY_MS=1200`
- `RELATION_STALE_MINUTES=35`
- `CME_STALE_MINUTES=35`
- `SYMBOL_SESSION_MODE_XAUUSD=auto`
- `SYMBOL_SESSION_MODE_THBUSD=auto`
- `SYMBOL_SESSION_MODE_BTCUSD=auto`
- `CME_SESSION_TIMEZONE=America/Chicago`
- `CME_HOLIDAY_CLOSURES=`
- `CME_SESSION_FORCE_OPEN=false`
- `WEBHOOK_LOG_RETENTION_DAYS=7`
- `JOB_RUNS_RETENTION_DAYS=30`
- `AUTH_LOCKOUTS_RETENTION_DAYS=30`
- `CME_SERIES_LINKS_RETENTION_DAYS=90`

## 8. Deploy and Wait Healthy

1. Trigger deployment for both services.
2. Check logs until both are running.
3. Validate worker endpoints:
   - `GET /health` -> `{ "ok": true }`
   - `GET /health/details` with header `x-worker-secret`

## 9. First System Validation

1. Open deployed web app.
2. Login as admin user.
3. Go `/settings`.
4. Save CME URL for current trade date.
5. Click `Run Both Now`.
6. Confirm `job_runs` show success and no critical errors.

## 10. Connect TradingView Webhook (Production URL)

1. In TradingView alert, webhook URL:
   - `https://<your-web-domain>/api/webhooks/tradingview`
2. Alert body format:

```json
{
  "symbol": "{{ticker}}",
  "price": {{close}},
  "timestamp": "{{time}}",
  "interval": "{{interval}}",
  "exchange": "{{exchange}}",
  "secret": "TRADINGVIEW_WEBHOOK_SECRET"
}
```

3. Verify in `/settings` webhook telemetry:
   - 2xx increases
   - 4xx near zero
4. Verify in `/settings` login abuse monitoring:
   - `Active lockouts` and `Failed attempts (24h)` reflect expected auth behavior.

## 11. Daily Operations

1. After `05:30 GMT+7`, update CME link in `/settings`.
2. Run `Run CME Now` once.
3. Confirm latest `intraday` and `oi` snapshots exist.
4. Check `Top 3 Strike Changes` compare now vs previous for same series.

## 12. Fast Troubleshooting

1. If webhook 400:
   - usually invalid JSON or wrong `secret`.
2. If CME skipped:
   - check market session gate and link status in settings.
3. If build cache errors:
   - run `npm run clean:web` and rebuild.
4. If manual run-now rejected:
   - wait cooldown seconds (`RUN_NOW_COOLDOWN_SECONDS`).

## 13. Final Safety Checklist

1. `WORKER_CONTROL_SECRET` same in web/worker.
2. Supabase RLS migrations applied.
3. Admin user exists in `user_roles`.
4. Test command passes locally:
   - `npm run test`
5. Worker and web both healthy after restart.

## 14. Performance + Cost Controls (Recommended)

Use these to reduce resource usage while keeping UX responsive:

Web service:
- `NEXT_PUBLIC_DASHBOARD_POLL_MS=15000`
- `NEXT_PUBLIC_DASHBOARD_POLL_HIDDEN_MS=60000`
- `NEXT_PUBLIC_DASHBOARD_POLL_MAX_BACKOFF_MS=120000`

Notes:
- Background tabs will poll slower automatically (lower API + DB load).
- Fetch errors/offline states back off automatically (prevents request storms).
- Keep `WEBHOOK_RATE_LIMIT_PER_MINUTE` and `AUTH_SESSION_RATE_LIMIT_PER_MINUTE` enabled; tune upward only when needed.
- Keep `AUTH_LOGIN_RATE_LIMIT_PER_MINUTE` conservative (default `15`) and tighten if repeated abuse appears in settings telemetry.

Worker service:
- Keep `WORKER_CRON_RELATION` and `WORKER_CRON_CME` at `*/30 * * * *` unless business needs tighter cadence.
- Keep `CME_EXTRACT_MAX_ATTEMPTS=3`; increasing retries raises CPU/runtime cost.
- Keep retention jobs enabled (prevents table growth and query cost drift).

Operational tips:
1. Scale service size only after checking real CPU/memory metrics for 3-7 days.
2. Avoid running `Run Both Now` repeatedly during stable periods.
3. If cost spikes, first increase hidden poll interval, then review webhook noise/invalid payload rates.
