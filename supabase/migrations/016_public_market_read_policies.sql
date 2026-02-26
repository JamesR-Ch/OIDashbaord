-- Allow anonymous read access for public dashboard pages that now query Supabase directly from the browser.
-- Keep admin/worker write paths protected by existing service-role/admin policies.

drop policy if exists "anon can read market tables" on public.price_ticks;
create policy "anon can read market tables" on public.price_ticks
  for select using (auth.role() = 'anon');

drop policy if exists "anon can read cme snapshots" on public.cme_snapshots;
create policy "anon can read cme snapshots" on public.cme_snapshots
  for select using (auth.role() = 'anon');

drop policy if exists "anon can read cme top actives" on public.cme_top_actives;
create policy "anon can read cme top actives" on public.cme_top_actives
  for select using (auth.role() = 'anon');

drop policy if exists "anon can read cme deltas" on public.cme_snapshot_deltas;
create policy "anon can read cme deltas" on public.cme_snapshot_deltas
  for select using (auth.role() = 'anon');

drop policy if exists "anon can read cme top strike changes" on public.cme_top_strike_changes;
create policy "anon can read cme top strike changes" on public.cme_top_strike_changes
  for select using (auth.role() = 'anon');

drop policy if exists "anon can read relation snapshots" on public.relation_snapshots_30m;
create policy "anon can read relation snapshots" on public.relation_snapshots_30m
  for select using (auth.role() = 'anon');
