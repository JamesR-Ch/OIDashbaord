create or replace function public.cleanup_oidashboard_data(
  structured_days integer default 45,
  artifact_days integer default 1
)
returns void
language plpgsql
security definer
as $$
declare
  structured_cutoff timestamptz;
  artifact_cutoff timestamptz;
begin
  structured_cutoff := now() - make_interval(days => structured_days);
  artifact_cutoff := now() - make_interval(days => artifact_days);

  delete from public.price_ticks where event_time_utc < structured_cutoff;
  delete from public.relation_snapshots_30m where anchor_time_utc < structured_cutoff;
  delete from public.cme_snapshots where snapshot_time_utc < structured_cutoff;
  delete from public.artifact_files where expires_at < artifact_cutoff;
end;
$$;
