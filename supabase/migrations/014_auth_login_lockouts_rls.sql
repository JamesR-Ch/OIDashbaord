alter table public.auth_login_lockouts enable row level security;

drop policy if exists "service role full access auth lockouts" on public.auth_login_lockouts;
create policy "service role full access auth lockouts" on public.auth_login_lockouts
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');
