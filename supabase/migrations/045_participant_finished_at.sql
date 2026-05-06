alter table public.animation_participants
  add column if not exists participation_ended_at timestamptz;

create index if not exists animation_participants_participation_ended_at
  on public.animation_participants(animation_id, participation_ended_at);

