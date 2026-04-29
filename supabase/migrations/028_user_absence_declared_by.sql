alter table user_absences
  add column if not exists declared_by uuid references profiles(id) on delete set null;

update user_absences
set declared_by = user_id
where declared_by is null;

create index if not exists idx_user_absences_declared_by on user_absences(declared_by);
