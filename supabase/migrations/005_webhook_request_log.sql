create table if not exists public.webhook_request_log (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'tradingview',
  ip text not null,
  status_code integer not null,
  note text,
  received_at timestamptz not null default now()
);

create index if not exists idx_webhook_request_log_source_ip_received_at
  on public.webhook_request_log (source, ip, received_at desc);

alter table public.webhook_request_log enable row level security;

drop policy if exists "service role full access webhook request log" on public.webhook_request_log;
create policy "service role full access webhook request log" on public.webhook_request_log
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

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
  delete from public.webhook_replay_guard where expires_at < now();
  delete from public.webhook_request_log where received_at < now() - make_interval(days => 7);
end;
$$;
