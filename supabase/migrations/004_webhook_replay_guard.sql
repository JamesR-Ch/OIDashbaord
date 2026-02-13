create table if not exists public.webhook_replay_guard (
  fingerprint text primary key,
  source text not null default 'tradingview',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index if not exists idx_webhook_replay_guard_expires_at
  on public.webhook_replay_guard (expires_at);

alter table public.webhook_replay_guard enable row level security;

drop policy if exists "service role full access webhook replay guard" on public.webhook_replay_guard;
create policy "service role full access webhook replay guard" on public.webhook_replay_guard
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
end;
$$;
