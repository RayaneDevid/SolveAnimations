create table animation_messages (
  id uuid primary key default gen_random_uuid(),
  animation_id uuid not null references animations(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  constraint animation_messages_content_length check (char_length(content) between 1 and 1000)
);

create index animation_messages_animation_created_idx
  on animation_messages(animation_id, created_at);

alter table animation_messages enable row level security;

-- Any authenticated staff member can read messages
create policy "staff read messages"
  on animation_messages for select
  using ((auth.jwt() ->> 'app_role') is not null);

-- Staff can only insert their own messages
create policy "staff send messages"
  on animation_messages for insert
  with check (
    auth.uid() = user_id
    and (auth.jwt() ->> 'app_role') is not null
  );

-- Enable Realtime on this table
alter publication supabase_realtime add table animation_messages;
