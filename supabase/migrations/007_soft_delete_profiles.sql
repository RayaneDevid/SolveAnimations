-- Soft-delete support for profiles
alter table profiles
  add column if not exists is_active          boolean     not null default true,
  add column if not exists deactivated_at     timestamptz,
  add column if not exists deactivation_reason text,
  add column if not exists deactivated_by     uuid references profiles(id) on delete set null;

create index if not exists profiles_is_active_idx on profiles (is_active);
