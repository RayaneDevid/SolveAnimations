alter table public.animations
  add column if not exists bdm_spontaneous boolean not null default false,
  add column if not exists bdm_mission_rank text not null default 'B',
  add column if not exists bdm_mission_type text not null default 'jetable';

update public.animations
set
  bdm_mission_rank = 'B',
  bdm_mission_type = 'jetable',
  bdm_spontaneous = false
where bdm_mission = true
  and (
    bdm_mission_rank is distinct from 'B'
    or bdm_mission_type is distinct from 'jetable'
    or bdm_spontaneous is distinct from false
  );

alter table public.animations
  drop constraint if exists animations_bdm_mission_rank_check,
  drop constraint if exists animations_bdm_mission_type_check,
  drop constraint if exists animations_bdm_spontaneous_check;

alter table public.animations
  add constraint animations_bdm_mission_rank_check
    check (bdm_mission_rank in ('D', 'C', 'B', 'A', 'S')),
  add constraint animations_bdm_mission_type_check
    check (bdm_mission_type in ('jetable', 'elaboree', 'grande_ampleur')),
  add constraint animations_bdm_spontaneous_check
    check (bdm_mission = true or bdm_spontaneous = false);

create index if not exists animations_bdm_mission_rank_type
  on public.animations(bdm_mission_rank, bdm_mission_type)
  where bdm_mission = true;
