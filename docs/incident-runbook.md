# OIDashboard Incident Runbook (V1)

## Scope

Operational response for:
- `relation_30m` failures/staleness
- `cme_30m` failures/staleness
- webhook delivery degradation (4xx/5xx spikes)
- worker health endpoint failures

## Severity

- `critical`:
  - worker health unavailable
  - latest relation/cme job status = failed
  - webhook 5xx >= configured threshold
- `warning`:
  - relation/cme stale beyond thresholds
  - webhook 4xx rate above threshold with sufficient samples
- `info`:
  - no actionable incident

## First 5 Minutes Checklist

1. Open `/settings` -> `System Alert Events`.
2. Confirm latest `job_runs` rows and error messages.
3. Check worker endpoint:
   - `GET /health`
   - `GET /health/details` with `x-worker-secret`
4. Check webhook telemetry in last hour:
   - total volume
   - 4xx/5xx counts
   - top notes

## Playbooks

### A) Relation job failed or stale

1. Trigger `Run Relation Now`.
2. If still failing:
   - inspect worker logs around `relation job failed`
   - verify Supabase connectivity and query errors
   - verify symbol session gate results in `/health/details`
3. If market closed for symbols, stale warning can be expected.

### B) CME job failed or stale

1. Confirm daily CME link is updated after 05:30 GMT+7.
2. Trigger `Run CME Now`.
3. If still failing:
   - inspect worker logs around `cme job failed`
   - verify Playwright runtime dependencies and URL validity
   - confirm worker can access CME target URL

### C) Webhook 4xx spike

1. Inspect top webhook `note` values.
2. Validate TradingView alert JSON schema.
3. Confirm `TRADINGVIEW_WEBHOOK_SECRET` matches payload.
4. Confirm timestamp skew is within `WEBHOOK_MAX_SKEW_SECONDS`.

### D) Webhook 5xx spike

1. Check web service logs around `/api/webhooks/tradingview`.
2. Verify Supabase write path is healthy.
3. Check worker control endpoint reachability if relevant.

### E) Worker health unavailable

1. Verify worker deployment status in Railway.
2. Validate:
   - `WORKER_CONTROL_URL`
   - `WORKER_CONTROL_SECRET` (must match web + worker)
3. Redeploy worker if process is unhealthy.

## Recovery Validation

1. `job_runs` latest statuses become `success`.
2. Stale alerts clear in `/settings`.
3. Webhook telemetry returns to stable 2xx-dominant pattern.
4. `/overview` and `/cme` reflect fresh snapshots.

## Post-Incident Notes

Record:
- start/end time
- root cause
- mitigations
- permanent fix item
- owner and due date

