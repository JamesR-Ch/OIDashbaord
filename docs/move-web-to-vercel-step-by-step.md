# OIDashboard: Move Web Service to Vercel (Very Detailed, No Git Push Steps)

This guide moves only the `web` app (`apps/web`) to Vercel and keeps `worker` on Railway.

It intentionally excludes Git push instructions.

## Scope

- Deploy target:
  - `web` -> Vercel
  - `worker` -> Railway (unchanged)
  - `database/auth` -> Supabase (unchanged)
- Keep current backend APIs, DB schema, and worker jobs.
- Keep current security model:
  - Public read pages: `/overview`, `/cme`, `/relations`
  - Admin page: `/settings`

## Topology After Migration

1. Browser calls Vercel web app.
2. Vercel API routes call Supabase.
3. `/api/settings/run-now` in Vercel calls Railway worker via `WORKER_CONTROL_URL`.
4. TradingView sends webhooks to Vercel URL.

## 0. Prerequisites Checklist

Before starting, confirm:

1. Supabase migrations `001` to `015` already applied.
2. At least one admin exists in `public.user_roles`.
3. Railway worker is healthy:
   - `GET https://<worker-domain>/health` returns `{ "ok": true }`.
4. You have these values ready:
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY`
   - `TRADINGVIEW_WEBHOOK_SECRET`
   - `WORKER_CONTROL_SECRET`
   - Railway worker public URL (must include `https://`)

## 1. Collect Production Values (Single Source of Truth)

Prepare a private note with exact values:

1. `SUPABASE_URL`:
   - Supabase -> Project Settings -> API -> Project URL.
2. `SUPABASE_PUBLISHABLE_KEY`:
   - Supabase -> Project Settings -> API -> Publishable key.
3. `SUPABASE_SECRET_KEY`:
   - Supabase -> Project Settings -> API -> Secret key.
4. `WORKER_CONTROL_URL`:
   - Railway worker public domain, for example:
   - `https://worker-production-xxxx.up.railway.app`
   - Do not omit `https://`.
5. `WORKER_CONTROL_SECRET`:
   - Must match worker env exactly.
6. `TRADINGVIEW_WEBHOOK_SECRET`:
   - Same value used in TradingView JSON payload `secret`.

## 2. Verify Worker Before Switching Web

Run these in terminal and confirm status `200`:

```bash
curl -i https://<worker-domain>/health
curl -i -H "x-worker-secret: <WORKER_CONTROL_SECRET>" https://<worker-domain>/health/details
```

Expected:

1. `/health` contains `"ok":true`.
2. `/health/details` returns worker diagnostics JSON.

If worker is not healthy, fix worker first, then continue.

## 3. Configure Supabase Auth URLs (Critical)

This prevents OAuth redirects back to `localhost`.

In Supabase Dashboard:

1. Go to `Authentication` -> `URL Configuration`.
2. Set `Site URL` to your Vercel production domain:
   - `https://<your-vercel-domain>`
3. Add Redirect URLs:
   - `https://<your-vercel-domain>/login`
   - `https://<your-vercel-domain>/*`
   - `http://localhost:3000/login` (optional for local dev)
   - `http://localhost:3000/*` (optional for local dev)
4. Save.

If you use preview deployments, add:

1. `https://*.vercel.app/login`
2. `https://*.vercel.app/*`

## 4. Create Vercel Project for Monorepo

In Vercel:

1. Create a new project from your existing repo.
2. Framework preset: `Next.js`.
3. Configure build settings:
   - Root Directory: repo root (`.`)
   - Install Command: `npm ci`
   - Build Command: `npm run build -w @oid/web`
   - Output Directory: leave empty
4. Node version: `22.x` (recommended to match current runtime baseline).

Notes:

1. This project is a monorepo with npm workspaces.
2. `@oid/web` depends on `@oid/shared`, so workspace install at repo root is required.

## 5. Set Vercel Environment Variables

Set these in Vercel Project -> Settings -> Environment Variables.

Apply to `Production` at minimum.

### 5.1 Required (minimal)

1. `SUPABASE_URL=<...>`
2. `SUPABASE_PUBLISHABLE_KEY=<...>`
3. `SUPABASE_SECRET_KEY=<...>`
4. `TRADINGVIEW_WEBHOOK_SECRET=<...>`
5. `WORKER_CONTROL_URL=https://<worker-domain>`
6. `WORKER_CONTROL_SECRET=<must match worker>`

Optional (branding only):

1. `NEXT_PUBLIC_APP_NAME=OIDashboard`

### 5.1.1 Why `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` are optional here

You do not have to set them in Vercel for this codebase.

Reason:

1. `apps/web/next.config.ts` auto-maps:
   - `NEXT_PUBLIC_SUPABASE_URL` from `SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `SUPABASE_PUBLISHABLE_KEY`
2. So your Railway behavior and Vercel behavior can be the same with only server-side Supabase envs set.
3. Only set `NEXT_PUBLIC_SUPABASE_*` directly if you intentionally want different browser values from server values.

### 5.2 Webhook Auth Mode (optional override; defaults already in code)

Direct TradingView JSON body secret mode:

1. `WEBHOOK_REQUIRE_SIGNATURE=false`
2. `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=true`

Strict HMAC header mode (only if sender supports `x-tv-signature`):

1. `WEBHOOK_REQUIRE_SIGNATURE=true`
2. `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=false`

If you do not set these two vars, current default behavior is direct TradingView mode:

1. `WEBHOOK_REQUIRE_SIGNATURE=false`
2. `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=true`

### 5.3 Security/Rate Limits (optional override; code defaults shown)

You can skip all below and app will use these defaults:

1. `WEBHOOK_MAX_SKEW_SECONDS=600`
2. `WEBHOOK_REPLAY_TTL_MINUTES=120`
3. `WEBHOOK_RATE_LIMIT_PER_MINUTE=180`
4. `WEBHOOK_MAX_BODY_BYTES=16384`
5. `RUN_NOW_COOLDOWN_SECONDS=20`
6. `CME_LINK_UPDATE_COOLDOWN_SECONDS=20`
7. `AUTH_SESSION_RATE_LIMIT_PER_MINUTE=30`
8. `AUTH_LOGIN_RATE_LIMIT_PER_MINUTE=15`
9. `ADMIN_API_RATE_LIMIT_PER_MINUTE=60`
10. `AUTH_LOGIN_MAX_FAILED_ATTEMPTS=5`
11. `AUTH_LOGIN_LOCK_MINUTES=15`

### 5.4 Cost/Performance Polling (optional override; code defaults shown)

You can skip all below and app will use these defaults:

1. `NEXT_PUBLIC_DASHBOARD_POLL_MS=30000`
2. `NEXT_PUBLIC_DASHBOARD_POLL_HIDDEN_MS=180000`
3. `NEXT_PUBLIC_DASHBOARD_POLL_MAX_BACKOFF_MS=300000`

## 6. Deploy on Vercel

1. Trigger deployment from Vercel UI.
2. Wait until status is `Ready`.
3. Open the deployment URL and verify app loads.

## 7. Post-Deploy Validation (Run in Order)

### 7.1 Public pages

Open and verify:

1. `/overview`
2. `/cme`
3. `/relations`

### 7.2 Auth + admin routes

1. Login as admin.
2. Open `/settings`.
3. Verify no redirect bounce loop.
4. Verify settings APIs load normally.

### 7.3 Run-now integration with worker

In `/settings`:

1. Click `Run Relation Now`.
2. Click `Run CME Now`.
3. Check `Latest Run Status`.

If run-now fails, see troubleshooting section for `WORKER_CONTROL_URL` and secret checks.

### 7.4 Webhook endpoint quick test

Send test payload:

```bash
curl -i -X POST "https://<your-vercel-domain>/api/webhooks/tradingview" \
  -H "content-type: application/json" \
  --data '{"symbol":"XAUUSD","price":2950.12,"timestamp":"2026-02-25T12:00:00Z","interval":"1","exchange":"OANDA","secret":"<TRADINGVIEW_WEBHOOK_SECRET>"}'
```

Expected:

1. HTTP `200`.
2. Response contains `{"ok": true}`.
3. `/settings` webhook telemetry updates.

### 7.5 TradingView cutover

In TradingView alert config:

1. Set webhook URL:
   - `https://<your-vercel-domain>/api/webhooks/tradingview`
2. Keep payload `secret` matching `TRADINGVIEW_WEBHOOK_SECRET`.
3. Confirm new events appear in `/settings` -> Webhook telemetry.

## 8. Troubleshooting Matrix

### Error: `Failed to parse URL from worker-production.../run-now`

Cause:

1. `WORKER_CONTROL_URL` missing scheme.

Fix:

1. Use full URL including protocol:
   - `https://worker-production-xxxx.up.railway.app`
2. Redeploy web.

### Error: `/api/settings/run-now` returns `502`

Causes:

1. Worker unreachable.
2. `WORKER_CONTROL_SECRET` mismatch.
3. Worker not healthy.

Fix:

1. Check worker `/health`.
2. Verify same secret on both Vercel web and Railway worker.
3. Ensure worker URL is public and correct.

### Error: GitHub login redirects to `localhost`

Cause:

1. Supabase `Site URL`/redirect URLs still point to localhost.

Fix:

1. Update `Authentication -> URL Configuration` as in Section 3.
2. Retry login.

### Error: `401 invalid webhook auth`

Cause:

1. Webhook mode and TradingView payload do not match.

Fix:

1. If using TradingView JSON `secret`, set:
   - `WEBHOOK_REQUIRE_SIGNATURE=false`
   - `WEBHOOK_ALLOW_BODY_SECRET_FALLBACK=true`
2. Ensure payload `secret` exactly matches env value.

### `/settings` redirects to `/overview` for admin

Cause:

1. Missing or wrong `public.user_roles` row in Supabase.

Fix:

1. Verify role:

```sql
select user_id, role from public.user_roles where user_id = '<admin_user_uuid>';
```

2. Upsert admin role if needed:

```sql
insert into public.user_roles (user_id, role)
values ('<admin_user_uuid>', 'admin')
on conflict (user_id) do update set role = excluded.role;
```

## 9. Security Checklist Before Final Use

1. `SUPABASE_SECRET_KEY` exists only in server env, never exposed in client code.
2. `WORKER_CONTROL_SECRET` is long/random and matches worker.
3. Webhook auth mode is explicitly set (not implicit).
4. Admin role entries are correct in `user_roles`.
5. Debug logging is disabled in production.
6. Rotate secrets if any were previously exposed.

## 10. Cost/Performance Notes (Vercel + Railway)

1. Keep polling defaults (`30s` visible, `180s` hidden).
2. Keep worker cron at `*/30` unless tighter cadence is truly needed.
3. Avoid frequent manual run-now in stable periods.
4. Monitor Vercel function invocations and Railway RAM trend weekly.
5. Keep retention jobs active to prevent DB growth drift.

## 11. Rollback Plan (If Needed)

If Vercel web has issues:

1. Point TradingView webhook URL back to old stable web URL.
2. Keep worker unchanged on Railway.
3. Fix env/config in Vercel.
4. Redeploy and retest using Section 7.

## 12. Final Go-Live Checklist

1. Vercel deployment `Ready`.
2. `/overview`, `/cme`, `/relations` load publicly.
3. Admin login works, `/settings` accessible for admin only.
4. Run-now works from `/settings`.
5. TradingView alerts return `200`.
6. Job runs and dashboards update as expected.
7. No auth redirect loops and no request spam in logs.
