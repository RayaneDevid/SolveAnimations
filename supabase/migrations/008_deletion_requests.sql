create table deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  animation_id uuid not null references animations(id) on delete cascade,
  requested_by uuid not null references profiles(id),
  requested_at timestamptz not null default now(),
  status       text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by   uuid references profiles(id),
  decided_at   timestamptz
);

-- At most one pending request per animation at a time
create unique index deletion_requests_one_pending
  on deletion_requests(animation_id) where status = 'pending';

alter table deletion_requests enable row level security;

-- Staff can read all deletion requests
create policy "staff can read deletion_requests"
  on deletion_requests for select
  using (auth.role() = 'authenticated');
