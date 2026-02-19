# OIDashboard

Monorepo for gold/options intelligence dashboard:
- `apps/web`: Next.js dashboard + APIs + admin
- `apps/worker`: scheduled jobs (relation engine, CME extraction, retention)
- `packages/shared`: shared schemas, types, and quant math

## Quick start

1. Copy `.env.example` to `.env` and set values.
2. Install dependencies:
   - `npm install`
3. Run web app:
   - `npm run dev:web`
4. Run worker:
   - `npm run dev:worker`

## Run-now commands (worker)

- `npm run run:once:relation -w @oid/worker`
- `npm run run:once:cme -w @oid/worker`
- `npm run run:once:retention -w @oid/worker`
- `npm run run:once -w @oid/worker` (runs all)
- `npm run sanity -w @oid/worker` (quick DB health summary)

## Required Supabase migrations

Run in order:

1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/002_rls_policies.sql`
3. `supabase/migrations/003_retention_functions.sql`
4. `supabase/migrations/004_webhook_replay_guard.sql`
5. `supabase/migrations/005_webhook_request_log.sql`
6. `supabase/migrations/006_cme_expiration_and_top_actives.sql`
7. `supabase/migrations/007_cme_dte_decimal.sql`
8. `supabase/migrations/008_job_idempotency_keys.sql`
9. `supabase/migrations/009_cme_change_analytics.sql`
10. `supabase/migrations/010_cme_change_rls.sql`
11. `supabase/migrations/011_cme_delta_previous_times.sql`
12. `supabase/migrations/012_backfill_cme_delta_previous_times.sql`
13. `supabase/migrations/013_auth_login_lockouts.sql`
14. `supabase/migrations/014_auth_login_lockouts_rls.sql`
15. `supabase/migrations/015_function_search_path_hardening.sql`

## Deployment target

- Web + Worker on Railway
- PostgreSQL on Supabase

## Notes

- CME extraction is blocked until daily manual link update after 05:30 GMT+7.
- Relation analytics run only during FX trading session hours.
- Symbol market-hour assumptions for relation engine:
  - `BTCUSD`: crypto 24/7
  - `XAUUSD`, `THBUSD`: CET server-time schedule (`Europe/Berlin`):
    - Mon-Thu: 00:00-23:00
    - Fri: 00:00-22:00
    - Sat/Sun: closed
- You can override per symbol using env:
  - `SYMBOL_SESSION_MODE_XAUUSD`
  - `SYMBOL_SESSION_MODE_THBUSD`
  - `SYMBOL_SESSION_MODE_BTCUSD`
  - Values: `auto`, `always_open`, `always_closed`, `fx_24_5`, `ifc_metal`
- Data retention defaults: 45 days (structured), 1 day (artifacts).
- Additional retention defaults:
  - `job_runs`: 30 days
  - `auth_login_lockouts`: 30 days
  - `cme_series_links`: 90 days
- CME snapshot deltas are computed against the previous snapshot of the same `view_type` and same `series_name`.
- Top 3 strike changes are ranked by positive `total_change` only (largest increase first).
- CME series follows the currently selected state embedded in the saved QuikStrike URL.
- Worker exposes:
  - `/health`
  - `/health/details` (latest jobs + currently running jobs)
- Settings page includes:
  - worker health panel
  - stale-alert panel (relation/CME age + last status)
- Password login has lockout protection:
  - `AUTH_LOGIN_RATE_LIMIT_PER_MINUTE` (default 15)
  - `AUTH_LOGIN_MAX_FAILED_ATTEMPTS` (default 5)
  - `AUTH_LOGIN_LOCK_MINUTES` (default 15)
- Settings page includes login abuse telemetry:
  - active lockouts
  - failed attempts (24h)
  - recent lockout rows
- TradingView direct webhook mode (recommended for current setup):
  - `WEBHOOK_REQUIRE_SIGNATURE=false`
  - `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=true`
- Strict HMAC mode (only if sender can provide `x-tv-signature`):
  - `WEBHOOK_REQUIRE_SIGNATURE=true`
  - `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=false`


## Frontend UI Stack

- Next.js App Router
- Tailwind CSS token system
- shadcn-style reusable primitives (`apps/web/components/ui`)
- Branded shell with logo/favicon from `logo/logo.png`

Core routes:
- Public read: `/overview`, `/cme`, `/relations`
- Admin only: `/settings` (middleware + server-side role check)

Data refresh:
- Frontend polls `/api/dashboard/overview-public` every 15s for V1
- Polling is adaptive for cost/performance:
  - visible tab: `NEXT_PUBLIC_DASHBOARD_POLL_MS` (default `15000`)
  - background tab: `NEXT_PUBLIC_DASHBOARD_POLL_HIDDEN_MS` (default `60000`)
  - fetch errors/offline use backoff up to `NEXT_PUBLIC_DASHBOARD_POLL_MAX_BACKOFF_MS` (default `120000`)
- Realtime subscriptions are intentionally deferred to later phase

## TradingView Live Checklist

1. Ensure `TRADINGVIEW_WEBHOOK_SECRET` in `.env` matches the alert payload `secret`.
2. Create 3 alerts in TradingView (`XAUUSD`, `THBUSD`, `BTCUSD`) with interval 1 minute.
3. Set webhook URL to:
   - `http://localhost:3000/api/webhooks/tradingview` (local)
4. Alert message template:

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

5. Verify ingestion:
   - `npm run sanity -w @oid/worker`
   - `/overview` should show fresh ages for all three symbols.

## TradingView Troubleshooting

- `400 invalid json payload`:
  - alert message is not valid JSON (missing comma, wrong braces, etc.)
- `400 schema_validation_failed`:
  - missing required fields (`symbol`/`ticker`, `price`, `timestamp`/`time`)
- `400 unsupported_symbol_...`:
  - symbol not recognized after normalization (expected XAUUSD, THBUSD/USDTHB, BTCUSD)
- `400 payload timestamp outside allowed skew`:
  - TradingView timestamp too far from server time (see `WEBHOOK_MAX_SKEW_SECONDS`)
- `413 payload too large`:
  - TradingView payload exceeded `WEBHOOK_MAX_BODY_BYTES`
- `401 invalid webhook authentication`:
  - `secret` in TradingView message does not match `.env` `TRADINGVIEW_WEBHOOK_SECRET`
- `404 /api/v1/webhook/tradingview`:
  - wrong endpoint path; use `/api/webhooks/tradingview`

## Admin API Safeguards

- `POST /api/settings/run-now` has cooldown protection (`RUN_NOW_COOLDOWN_SECONDS`).
- `PUT /api/settings/cme-link` has cooldown protection (`CME_LINK_UPDATE_COOLDOWN_SECONDS`).
- CME link updates accept only `https://cmegroup-tools.quikstrike.net/...QuikStrikeView.aspx`.

## Local Build Cache Reset

If Next.js throws errors like `Cannot find module './207.js'` from `.next/server`:

1. Stop dev servers.
2. Run:
   - `npm run clean:web`
3. Start again:
   - `npm run dev:web`

## Tests

- Run backend math/ranking tests:
  - `npm run test`

## Incident Runbook

- See `docs/incident-runbook.md` for operational response steps and severity handling.
