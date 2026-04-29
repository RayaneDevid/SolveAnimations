alter table profiles
  add column if not exists available_roles staff_role[] not null default '{}';

update profiles
set available_roles = array[role]::staff_role[]
where cardinality(available_roles) = 0;
