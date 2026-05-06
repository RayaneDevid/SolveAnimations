with bdm_profiles as (
  select id
  from public.profiles
  where role in ('bdm', 'responsable_bdm')
    or 'bdm'::staff_role = any(available_roles)
    or 'responsable_bdm'::staff_role = any(available_roles)
),
bdm_report_users as (
  select
    a.id as animation_id,
    a.creator_id as user_id
  from public.animations as a
  join bdm_profiles as p on p.id = a.creator_id
  where a.bdm_mission = true
    and a.status = 'finished'

  union

  select
    ap.animation_id,
    ap.user_id
  from public.animation_participants as ap
  join public.animations as a on a.id = ap.animation_id
  join bdm_profiles as p on p.id = ap.user_id
  where a.bdm_mission = true
    and a.status = 'finished'
    and ap.status = 'validated'
)
insert into public.animation_reports (
  animation_id,
  user_id,
  pole,
  character_name,
  comments,
  submitted_at
)
select
  animation_id,
  user_id,
  'bdm',
  '—',
  null,
  null
from bdm_report_users
on conflict (animation_id, user_id) do update
set pole = 'bdm'
where public.animation_reports.pole <> 'bdm';

