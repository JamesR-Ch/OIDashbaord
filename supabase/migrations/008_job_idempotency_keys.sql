-- Deduplicate existing rows before adding unique indexes.
with ranked as (
  select id,
         row_number() over (
           partition by anchor_time_utc
           order by created_at desc, id desc
         ) as rn
  from public.relation_snapshots_30m
)
delete from public.relation_snapshots_30m
where id in (select id from ranked where rn > 1);

with ranked as (
  select id,
         row_number() over (
           partition by snapshot_time_utc, view_type
           order by created_at desc, id desc
         ) as rn
  from public.cme_snapshots
)
delete from public.cme_snapshots
where id in (select id from ranked where rn > 1);

create unique index if not exists idx_relation_snapshots_anchor_unique
  on public.relation_snapshots_30m(anchor_time_utc);

create unique index if not exists idx_cme_snapshots_time_view_unique
  on public.cme_snapshots(snapshot_time_utc, view_type);
