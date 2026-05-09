create table public.participant_time_correction_requests (
  id                  uuid primary key default gen_random_uuid(),
  animation_id        uuid not null references public.animations(id) on delete cascade,
  participant_id      uuid not null references public.animation_participants(id) on delete cascade,
  requested_by        uuid not null references public.profiles(id),
  requested_at        timestamptz not null default now(),
  current_joined_at   timestamptz,
  requested_joined_at timestamptz not null,
  reason              text check (reason is null or char_length(reason) <= 500),
  status              text not null default 'pending' check (status in ('pending', 'approved', 'denied')),
  decided_by          uuid references public.profiles(id),
  decided_at          timestamptz
);

create unique index participant_time_correction_requests_one_pending
  on public.participant_time_correction_requests(participant_id)
  where status = 'pending';

create index participant_time_correction_requests_status_requested_at
  on public.participant_time_correction_requests(status, requested_at);

create index participant_time_correction_requests_animation_status
  on public.participant_time_correction_requests(animation_id, status);

alter table public.participant_time_correction_requests enable row level security;

create policy "staff can read participant_time_correction_requests"
  on public.participant_time_correction_requests for select
  using (auth.role() = 'authenticated');
