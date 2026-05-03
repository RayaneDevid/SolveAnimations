alter table public.broadcasts
  drop constraint if exists broadcasts_audience_check;

alter table public.broadcasts
  add constraint broadcasts_audience_check
  check (audience in ('all', 'selected', 'pole_animation', 'pole_mj', 'pole_bdm'));
