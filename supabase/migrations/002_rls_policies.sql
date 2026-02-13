alter table price_ticks enable row level security;
alter table relation_snapshots_30m enable row level security;
alter table cme_series_links enable row level security;
alter table cme_snapshots enable row level security;
alter table cme_strike_bars enable row level security;
alter table cme_top_actives enable row level security;
alter table job_runs enable row level security;
alter table artifact_files enable row level security;
alter table user_roles enable row level security;

create or replace function public.current_app_role()
returns text
language sql
stable
as $$
  select coalesce(
    (select role from public.user_roles where user_id = auth.uid()),
    'viewer'
  );
$$;

drop policy if exists "viewer can read market tables" on public.price_ticks;
create policy "viewer can read market tables" on price_ticks
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read relation" on public.relation_snapshots_30m;
create policy "viewer can read relation" on relation_snapshots_30m
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read cme snapshots" on public.cme_snapshots;
create policy "viewer can read cme snapshots" on cme_snapshots
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read cme bars" on public.cme_strike_bars;
create policy "viewer can read cme bars" on cme_strike_bars
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read cme top" on public.cme_top_actives;
create policy "viewer can read cme top" on cme_top_actives
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read jobs" on public.job_runs;
create policy "viewer can read jobs" on job_runs
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read links" on public.cme_series_links;
create policy "viewer can read links" on cme_series_links
  for select using (auth.role() = 'authenticated');

drop policy if exists "admin update cme link" on public.cme_series_links;
create policy "admin update cme link" on cme_series_links
  for all using (public.current_app_role() = 'admin')
  with check (public.current_app_role() = 'admin');

drop policy if exists "service role full access price_ticks" on public.price_ticks;
create policy "service role full access price_ticks" on price_ticks
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access relation" on public.relation_snapshots_30m;
create policy "service role full access relation" on relation_snapshots_30m
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access cme snapshots" on public.cme_snapshots;
create policy "service role full access cme snapshots" on cme_snapshots
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access cme bars" on public.cme_strike_bars;
create policy "service role full access cme bars" on cme_strike_bars
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access cme top" on public.cme_top_actives;
create policy "service role full access cme top" on cme_top_actives
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access jobs" on public.job_runs;
create policy "service role full access jobs" on job_runs
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access artifacts" on public.artifact_files;
create policy "service role full access artifacts" on artifact_files
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access roles" on public.user_roles;
create policy "service role full access roles" on user_roles
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
