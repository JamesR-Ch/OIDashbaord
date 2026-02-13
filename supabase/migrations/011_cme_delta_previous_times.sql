alter table public.cme_snapshot_deltas
  add column if not exists previous_snapshot_time_utc timestamptz,
  add column if not exists previous_snapshot_time_bkk timestamptz;
