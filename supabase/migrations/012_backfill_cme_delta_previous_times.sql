update public.cme_snapshot_deltas d
set
  previous_snapshot_time_utc = s.snapshot_time_utc,
  previous_snapshot_time_bkk = s.snapshot_time_bkk
from public.cme_snapshots s
where d.previous_snapshot_id = s.id
  and (d.previous_snapshot_time_utc is null or d.previous_snapshot_time_bkk is null);
