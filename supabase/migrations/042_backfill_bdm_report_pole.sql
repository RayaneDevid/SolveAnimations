update public.animation_reports as ar
set pole = 'bdm'
from public.animations as a, public.profiles as p
where ar.animation_id = a.id
  and ar.user_id = p.id
  and a.bdm_mission = true
  and ar.pole <> 'bdm'
  and (
    p.role in ('bdm', 'responsable_bdm')
    or 'bdm'::staff_role = any(p.available_roles)
    or 'responsable_bdm'::staff_role = any(p.available_roles)
  );
