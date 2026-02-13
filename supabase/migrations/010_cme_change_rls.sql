alter table public.cme_snapshot_deltas enable row level security;
alter table public.cme_top_strike_changes enable row level security;

drop policy if exists "viewer can read cme deltas" on public.cme_snapshot_deltas;
create policy "viewer can read cme deltas" on public.cme_snapshot_deltas
  for select using (auth.role() = 'authenticated');

drop policy if exists "viewer can read cme top strike changes" on public.cme_top_strike_changes;
create policy "viewer can read cme top strike changes" on public.cme_top_strike_changes
  for select using (auth.role() = 'authenticated');

drop policy if exists "service role full access cme deltas" on public.cme_snapshot_deltas;
create policy "service role full access cme deltas" on public.cme_snapshot_deltas
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

drop policy if exists "service role full access cme strike changes" on public.cme_top_strike_changes;
create policy "service role full access cme strike changes" on public.cme_top_strike_changes
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
