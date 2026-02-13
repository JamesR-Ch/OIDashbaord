create table if not exists public.auth_login_lockouts (
  email text primary key,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  last_failed_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_auth_login_lockouts_locked_until
  on public.auth_login_lockouts (locked_until);
