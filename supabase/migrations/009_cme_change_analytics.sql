create table if not exists public.cme_snapshot_deltas (
  id uuid primary key default gen_random_uuid(),
  current_snapshot_id uuid not null unique references public.cme_snapshots(id) on delete cascade,
  previous_snapshot_id uuid not null references public.cme_snapshots(id) on delete cascade,
  view_type text not null check (view_type in ('intraday', 'oi')),
  snapshot_time_utc timestamptz not null,
  snapshot_time_bkk timestamptz not null,
  series_name text not null,
  put_before numeric(20,4) not null,
  put_now numeric(20,4) not null,
  put_change numeric(20,4) not null,
  call_before numeric(20,4) not null,
  call_now numeric(20,4) not null,
  call_change numeric(20,4) not null,
  vol_before numeric(20,4),
  vol_now numeric(20,4),
  vol_change numeric(20,4),
  future_before numeric(20,4),
  future_now numeric(20,4),
  future_change numeric(20,4),
  created_at timestamptz not null default now()
);

create index if not exists idx_cme_snapshot_deltas_time
  on public.cme_snapshot_deltas(snapshot_time_utc desc);

create table if not exists public.cme_top_strike_changes (
  id uuid primary key default gen_random_uuid(),
  delta_id uuid not null references public.cme_snapshot_deltas(id) on delete cascade,
  rank smallint not null check (rank between 1 and 3),
  strike numeric(20,4) not null,
  put_before numeric(20,4) not null,
  put_now numeric(20,4) not null,
  put_change numeric(20,4) not null,
  call_before numeric(20,4) not null,
  call_now numeric(20,4) not null,
  call_change numeric(20,4) not null,
  total_before numeric(20,4) not null,
  total_now numeric(20,4) not null,
  total_change numeric(20,4) not null,
  created_at timestamptz not null default now(),
  unique(delta_id, rank)
);

create index if not exists idx_cme_top_strike_changes_delta
  on public.cme_top_strike_changes(delta_id);
