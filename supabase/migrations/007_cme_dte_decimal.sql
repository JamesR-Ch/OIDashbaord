alter table public.cme_snapshots
  alter column series_dte type numeric(10,2)
  using case
    when series_dte is null then null
    else series_dte::numeric(10,2)
  end;
