alter table public.animation_participants
  add column if not exists joined_at timestamptz;

update public.animation_participants
set joined_at = applied_at
where joined_at is null;

create index if not exists animation_participants_joined_at
  on public.animation_participants(animation_id, joined_at);
