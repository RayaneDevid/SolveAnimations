-- Les animations "petite" n'existent plus : on migre l'historique en "moyenne"
-- et on empêche toute nouvelle insertion/mise à jour avec ce type.
update public.animations
set type = 'moyenne'::animation_type
where type = 'petite'::animation_type;

alter table public.animations
  drop constraint if exists animations_type_not_petite;

alter table public.animations
  add constraint animations_type_not_petite
  check (type <> 'petite'::animation_type);
