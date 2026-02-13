alter table public.cme_snapshots
  add column if not exists series_expiration_label text,
  add column if not exists series_expiration_date date,
  add column if not exists series_dte integer;

alter table public.cme_top_actives
  add column if not exists vol_settle numeric(20,6);
