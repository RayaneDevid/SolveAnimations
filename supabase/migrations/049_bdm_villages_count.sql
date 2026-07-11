alter table public.animations
  add column if not exists bdm_villages_count integer not null default 2;

alter table public.animations
  drop constraint if exists animations_bdm_villages_count_check;

alter table public.animations
  add constraint animations_bdm_villages_count_check
    check (bdm_villages_count in (1, 2, 3, 4));

create index if not exists animations_bdm_villages_count_type
  on public.animations(bdm_villages_count, bdm_mission_type)
  where bdm_mission = true;
