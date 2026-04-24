alter table animations
  drop constraint animations_required_participants_check;

alter table animations
  add constraint animations_required_participants_check
  check (required_participants >= 0);
