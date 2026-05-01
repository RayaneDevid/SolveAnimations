create table public.animation_time_correction_requests (
  id                            uuid primary key default gen_random_uuid(),
  animation_id                  uuid not null references public.animations(id) on delete cascade,
  requested_by                  uuid not null references public.profiles(id),
  requested_at                  timestamptz not null default now(),
  requested_started_at          timestamptz not null,
  requested_actual_duration_min int not null check (requested_actual_duration_min between 1 and 720),
  requested_actual_prep_time_min int not null default 0 check (requested_actual_prep_time_min between 0 and 600),
  reason                        text check (reason is null or char_length(reason) <= 500),
  status                        text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by                    uuid references public.profiles(id),
  decided_at                    timestamptz
);

create unique index animation_time_correction_requests_one_pending
  on public.animation_time_correction_requests(animation_id)
  where status = 'pending';

create index animation_time_correction_requests_status_requested_at
  on public.animation_time_correction_requests(status, requested_at);

alter table public.animation_time_correction_requests enable row level security;

create policy "staff can read animation_time_correction_requests"
  on public.animation_time_correction_requests for select
  using (auth.role() = 'authenticated');
