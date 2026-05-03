create table if not exists public.broadcasts (
  id uuid primary key default gen_random_uuid(),
  title text,
  message text not null check (char_length(trim(message)) between 1 and 2000),
  audience text not null default 'all' check (audience in ('all', 'selected')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  archived_by uuid references public.profiles(id) on delete set null,
  archived_at timestamptz
);

create table if not exists public.broadcast_recipients (
  broadcast_id uuid not null references public.broadcasts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (broadcast_id, user_id)
);

create index if not exists broadcasts_active_created_idx
  on public.broadcasts(created_at desc)
  where archived_at is null;

create index if not exists broadcast_recipients_user_idx
  on public.broadcast_recipients(user_id, broadcast_id);

alter table public.broadcasts enable row level security;
alter table public.broadcast_recipients enable row level security;
