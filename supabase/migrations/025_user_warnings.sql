create table if not exists user_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  created_by uuid references profiles(id) on delete set null,
  warning_date date not null,
  reason text not null check (char_length(trim(reason)) between 3 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_user_warnings_user_date on user_warnings(user_id, warning_date desc);
create index if not exists idx_user_warnings_created_by on user_warnings(created_by);

alter table user_warnings enable row level security;
