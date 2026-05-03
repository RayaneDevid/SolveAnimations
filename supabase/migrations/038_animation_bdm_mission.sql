alter table public.animations
  add column if not exists bdm_mission boolean not null default false;

create index if not exists animations_bdm_mission_finished
  on public.animations(started_at)
  where status = 'finished' and bdm_mission = true;
