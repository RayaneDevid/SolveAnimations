alter table public.animations
  add column if not exists pause_started_at timestamptz,
  add column if not exists paused_duration_min int not null default 0;

alter table public.animations
  drop constraint if exists animations_paused_duration_min_check;

alter table public.animations
  add constraint animations_paused_duration_min_check
  check (paused_duration_min >= 0);

