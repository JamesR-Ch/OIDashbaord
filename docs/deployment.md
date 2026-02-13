# Deployment (Railway + Supabase)

## Services

- `web`: Next.js app
- `worker`: Node job runner
- `db`: Supabase Postgres

## Environment Variables

Set in both Railway services where relevant:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY` (web only)
- `SUPABASE_SECRET_KEY` (web server routes + worker)
- `TRADINGVIEW_WEBHOOK_SECRET` (web only)
- `WEBHOOK_MAX_SKEW_SECONDS` (web only)
- `WEBHOOK_REPLAY_TTL_MINUTES` (web only)
- `WEBHOOK_RATE_LIMIT_PER_MINUTE` (web only)
- `WEBHOOK_MAX_BODY_BYTES` (web only)
- `WEBHOOK_REQUIRE_SIGNATURE` (web only; recommended `true` in production)
- `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK` (web only; recommended `false` in production)
- `RUN_NOW_COOLDOWN_SECONDS` (web only)
- `CME_LINK_UPDATE_COOLDOWN_SECONDS` (web only)
- `AUTH_SESSION_RATE_LIMIT_PER_MINUTE` (web only)
- `ADMIN_API_RATE_LIMIT_PER_MINUTE` (web only)
- `AUTH_LOGIN_MAX_FAILED_ATTEMPTS` (web only; default `5`)
- `AUTH_LOGIN_LOCK_MINUTES` (web only; default `15`)
- `WORKER_CRON_RELATION` (worker)
- `WORKER_CRON_CME` (worker)
- `WORKER_RETENTION_CRON` (worker)
- `WORKER_CONTROL_PORT` (worker)
- `WORKER_CONTROL_SECRET` (worker)
- `WORKER_CONTROL_URL` (web only, points to worker control endpoint)
- `CME_TIMEOUT_MS` (worker)
- `CME_HEADLESS` (worker)
- `CME_EXTRACT_MAX_ATTEMPTS` (worker)
- `CME_EXTRACT_RETRY_DELAY_MS` (worker)
- `RELATION_STALE_MINUTES` (worker, default `35`)
- `CME_STALE_MINUTES` (worker, default `35`)
- `SYMBOL_SESSION_MODE_XAUUSD` (worker; `auto|always_open|always_closed|fx_24_5`)
- `SYMBOL_SESSION_MODE_THBUSD` (worker; `auto|always_open|always_closed|fx_24_5`)
- `SYMBOL_SESSION_MODE_BTCUSD` (worker; `auto|always_open|always_closed|fx_24_5`)
- `CME_SESSION_TIMEZONE` (worker, default `America/Chicago`)
- `CME_HOLIDAY_CLOSURES` (worker, optional CSV of `YYYY-MM-DD`)
- `CME_SESSION_FORCE_OPEN` (worker, `false` in production)
- `WEBHOOK_LOG_RETENTION_DAYS` (worker)
- `JOB_RUNS_RETENTION_DAYS` (worker, default `30`)
- `AUTH_LOCKOUTS_RETENTION_DAYS` (worker, default `30`)
- `CME_SERIES_LINKS_RETENTION_DAYS` (worker, default `90`)

## Build / Start

### web
- Build: `npm run build -w @oid/web`
- Start: `npm run start -w @oid/web`

### worker
- Build: `npm run build -w @oid/worker`
- Start: `npm run start -w @oid/worker`

## Supabase setup

1. Run SQL files in order:
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
2. Seed admin role in `user_roles` for at least one auth user.
3. `002` is now rerunnable (uses `drop policy if exists` guards).

## Verification Queries

Use SQL Editor after deploy:

```sql
select job_name, status, started_at, finished_at, metadata, error_message
from public.job_runs
order by started_at desc
limit 20;
```

```sql
select symbol, price, event_time_utc
from public.price_ticks
order by event_time_utc desc
limit 20;
```

```sql
select status_code, count(*) as n
from public.webhook_request_log
where received_at >= now() - interval '1 hour'
group by status_code
order by status_code;
```

## Ops Notes

- At 05:30 GMT+7, daily CME URL must be updated in `/settings`.
- If not updated, worker writes skipped `cme_30m` job runs with reason metadata.
- Retention keeps 45-day structured data and 1-day artifacts.
- Additional retention:
  - `job_runs`: 30 days (configurable)
  - `auth_login_lockouts`: 30 days (configurable)
  - `cme_series_links`: 90 days (configurable)
- Webhook replay and rate-limit protections depend on migrations `004` and `005`.
- Worker health endpoints:
  - `/health`
  - `/health/details` (includes running jobs + latest run summary)

## Daily Runbook

1. Update CME link in `/settings` after 05:30 GMT+7.
2. Trigger `Run CME Now` once to validate the new link.
3. Verify quickly from terminal:
   - `npm run sanity -w @oid/worker`
4. Check expected signals:
   - `cme_30m` status = `success`
   - latest CME snapshots contain both `intraday` and `oi`
   - `series_name`, `series_dte`, and `series_expiration_date` are populated

## Final Go-Live Checklist

1. Migrations:
   - Ensure `001` through `013` have been applied in order.
2. Secrets/env:
   - Verify all required env vars are set in Railway web/worker services.
   - Confirm `WORKER_CONTROL_SECRET` is identical in web and worker.
3. Health:
   - `GET worker /health` returns `ok: true`.
   - `GET worker /health/details` (with secret) returns latest jobs and symbol sessions.
4. Auth/RBAC:
   - Confirm at least one `admin` row exists in `public.user_roles`.
5. Webhook:
   - Send a valid TradingView payload and verify `200` + `price_ticks` insert.
   - Confirm 4xx errors in `webhook_request_log` are near zero after alert template lock.
6. Schedulers:
   - Verify `relation_30m`, `cme_30m`, and `retention_cleanup` appear in `job_runs`.
7. CME gate:
   - After 05:30 GMT+7, update CME URL in `/settings` and run once.
   - Verify both views (`intraday`, `oi`) are persisted and delta tables update.
8. Test command:
   - Run `npm run test` from repo root and confirm both suites pass.
