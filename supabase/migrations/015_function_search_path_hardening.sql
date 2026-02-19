create or replace function public.current_app_role()
returns text
language sql
stable
set search_path = public, pg_temp
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'viewer'
  );
$$;

create or replace function public.cleanup_oidashboard_data(
  structured_days integer default 45,
  artifact_days integer default 1
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
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
  delete from public.webhook_replay_guard where expires_at < now();
  delete from public.webhook_request_log where received_at < now() - make_interval(days => 7);
end;
$$;
