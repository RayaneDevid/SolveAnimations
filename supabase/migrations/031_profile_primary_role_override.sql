alter table profiles
  add column if not exists primary_role_overridden boolean not null default false;
