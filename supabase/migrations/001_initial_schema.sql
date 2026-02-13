create extension if not exists pgcrypto;

create table if not exists price_ticks (
  id uuid primary key default gen_random_uuid(),
  symbol text not null check (symbol in ('XAUUSD', 'THBUSD', 'BTCUSD')),
  price numeric(20,8) not null,
  event_time_utc timestamptz not null,
  event_time_bkk timestamptz not null,
  ingested_at timestamptz not null default now(),
  unique (symbol, event_time_utc)
);

create index if not exists idx_price_ticks_event_time_utc on price_ticks(event_time_utc desc);
create index if not exists idx_price_ticks_symbol_event_time on price_ticks(symbol, event_time_utc desc);

create table if not exists relation_snapshots_30m (
  id uuid primary key default gen_random_uuid(),
  anchor_time_utc timestamptz not null,
  anchor_time_bkk timestamptz not null,
  window_start_utc timestamptz not null,
  window_end_utc timestamptz not null,
  window_start_bkk timestamptz not null,
  window_end_bkk timestamptz not null,
  symbol_returns jsonb not null,
  pair_metrics jsonb not null,
  quality_flags jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_relation_anchor on relation_snapshots_30m(anchor_time_utc desc);

create table if not exists cme_series_links (
  trade_date_bkk date primary key,
  url text not null,
  status text not null check (status in ('active', 'expired', 'pending_update')) default 'pending_update',
  updated_by text not null,
  updated_at timestamptz not null default now()
);

create table if not exists cme_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_time_utc timestamptz not null,
  snapshot_time_bkk timestamptz not null,
  trade_date_bkk date not null,
  series_name text not null,
  view_type text not null check (view_type in ('intraday', 'oi')),
  put_total numeric(20,4) not null,
  call_total numeric(20,4) not null,
  vol numeric(20,4),
  vol_chg numeric(20,4),
  future_chg numeric(20,4),
  xauusd_price_at_snapshot numeric(20,8),
  source_url text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cme_snapshots_time on cme_snapshots(snapshot_time_utc desc);

create table if not exists cme_strike_bars (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references cme_snapshots(id) on delete cascade,
  strike numeric(20,4) not null,
  put numeric(20,4) not null default 0,
  call numeric(20,4) not null default 0,
  vol_settle numeric(20,6),
  total_activity numeric(20,4) not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_cme_strike_bars_snapshot on cme_strike_bars(snapshot_id);

create table if not exists cme_top_actives (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references cme_snapshots(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  strike numeric(20,4) not null,
  put numeric(20,4) not null,
  call numeric(20,4) not null,
  total numeric(20,4) not null,
  created_at timestamptz not null default now(),
  unique(snapshot_id, rank)
);

create table if not exists job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null check (job_name in ('relation_30m', 'cme_30m', 'retention_cleanup')),
  status text not null check (status in ('success', 'failed', 'skipped')),
  started_at timestamptz not null,
  finished_at timestamptz,
  error_message text,
  metadata jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_job_runs_started on job_runs(started_at desc);

create table if not exists artifact_files (
  id uuid primary key default gen_random_uuid(),
  path text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create table if not exists user_roles (
  user_id uuid primary key,
  role text not null check (role in ('admin', 'viewer')),
  created_at timestamptz not null default now()
);
