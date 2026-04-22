-- ============================================================
-- EXTENSIONS
-- ============================================================
create extension if not exists "moddatetime" schema extensions;
create extension if not exists "uuid-ossp" schema extensions;

-- ============================================================
-- ENUMS
-- ============================================================
create type staff_role as enum ('responsable', 'senior', 'animateur', 'mj');

create type animation_status as enum (
  'pending_validation',
  'open',
  'running',
  'finished',
  'rejected',
  'cancelled',
  'postponed'
);

create type animation_server as enum ('S1','S2','S3','S4','S5','SE1','SE2','SE3');
create type animation_type   as enum ('petite','moyenne','grande');

create type village as enum (
  'konoha','suna','oto','kiri','temple_camelias','autre','tout_le_monde'
);

create type participant_status as enum ('pending','validated','rejected','removed');

-- ============================================================
-- PROFILES
-- ============================================================
create table public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  discord_id          text unique not null,
  username            text not null,
  avatar_url          text,
  role                staff_role not null,
  last_role_check_at  timestamptz not null default now(),
  created_at          timestamptz not null default now(),
  last_login_at       timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- staff can read all profiles (needed for participant lists, leaderboard, etc.)
create policy "profiles: staff can read all"
  on public.profiles for select
  using (
    exists (
      select 1 from public.profiles p2
      where p2.id = auth.uid()
    )
  );

-- users can update their own profile (avatar etc.) — via Edge Functions only
create policy "profiles: own update via service role"
  on public.profiles for all
  using (auth.uid() = id);

-- ============================================================
-- ANIMATIONS
-- ============================================================
create table public.animations (
  id                    uuid primary key default gen_random_uuid(),
  title                 text not null check (char_length(title) between 3 and 120),
  scheduled_at          timestamptz not null,
  planned_duration_min  int not null check (planned_duration_min >= 15),
  required_participants int not null check (required_participants >= 1),
  server                animation_server not null,
  type                  animation_type not null,
  prep_time_min         int not null default 0 check (prep_time_min >= 0),
  village               village not null,
  document_url          text not null,
  creator_id            uuid not null references public.profiles(id),
  creator_character_name text,
  status                animation_status not null default 'pending_validation',
  validated_by          uuid references public.profiles(id),
  validated_at          timestamptz,
  rejected_by           uuid references public.profiles(id),
  rejected_at           timestamptz,
  rejection_reason      text,
  started_at            timestamptz,
  ended_at              timestamptz,
  actual_duration_min   int,
  discord_message_id    text,
  postponed_from        timestamptz,
  postpone_count        int not null default 0,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index animations_status_scheduled on public.animations(status, scheduled_at);
create index animations_creator_status   on public.animations(creator_id, status);
create index animations_scheduled        on public.animations(scheduled_at);
create index animations_ended_finished   on public.animations(ended_at) where status = 'finished';

-- moddatetime trigger
create trigger animations_moddatetime
  before update on public.animations
  for each row execute procedure extensions.moddatetime(updated_at);

alter table public.animations enable row level security;

create policy "animations: staff can read all"
  on public.animations for select
  using (
    exists (select 1 from public.profiles where id = auth.uid())
  );

-- writes go through Edge Functions with service role — no direct write from client
create policy "animations: no direct insert"
  on public.animations for insert
  with check (false);

create policy "animations: no direct update"
  on public.animations for update
  using (false);

create policy "animations: no direct delete"
  on public.animations for delete
  using (false);

-- ============================================================
-- ANIMATION PARTICIPANTS
-- ============================================================
create table public.animation_participants (
  id            uuid primary key default gen_random_uuid(),
  animation_id  uuid not null references public.animations(id) on delete cascade,
  user_id       uuid not null references public.profiles(id),
  character_name text not null,
  status        participant_status not null default 'pending',
  applied_at    timestamptz not null default now(),
  decided_at    timestamptz,
  decided_by    uuid references public.profiles(id),
  constraint animation_participants_unique unique (animation_id, user_id)
);

create index participants_animation_id on public.animation_participants(animation_id);
create index participants_user_id      on public.animation_participants(user_id);

alter table public.animation_participants enable row level security;

create policy "participants: staff can read all"
  on public.animation_participants for select
  using (exists (select 1 from public.profiles where id = auth.uid()));

create policy "participants: no direct write"
  on public.animation_participants for all
  using (false)
  with check (false);

-- ============================================================
-- ANIMATION REPORTS
-- ============================================================
create table public.animation_reports (
  id            uuid primary key default gen_random_uuid(),
  animation_id  uuid not null references public.animations(id) on delete cascade,
  user_id       uuid not null references public.profiles(id),
  pole          text not null,
  character_name text not null,
  comments      text,
  submitted_at  timestamptz,
  created_at    timestamptz not null default now(),
  constraint animation_reports_unique unique (animation_id, user_id)
);

create index reports_user_id      on public.animation_reports(user_id);
create index reports_animation_id on public.animation_reports(animation_id);

alter table public.animation_reports enable row level security;

-- users can read their own reports
create policy "reports: own read"
  on public.animation_reports for select
  using (user_id = auth.uid());

-- responsable can read all
create policy "reports: responsable read all"
  on public.animation_reports for select
  using (
    (auth.jwt() ->> 'app_role')::staff_role = 'responsable'
  );

create policy "reports: no direct write"
  on public.animation_reports for all
  using (false)
  with check (false);

-- ============================================================
-- USER ABSENCES
-- ============================================================
create table public.user_absences (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  from_date  date not null,
  to_date    date not null check (to_date >= from_date),
  reason     text,
  created_at timestamptz not null default now()
);

create index absences_user_dates on public.user_absences(user_id, from_date, to_date);

alter table public.user_absences enable row level security;

create policy "absences: own read"
  on public.user_absences for select
  using (user_id = auth.uid());

create policy "absences: responsable read all"
  on public.user_absences for select
  using ((auth.jwt() ->> 'app_role')::staff_role = 'responsable');

create policy "absences: no direct write"
  on public.user_absences for all
  using (false)
  with check (false);

-- ============================================================
-- AUDIT LOG
-- ============================================================
create table public.audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id),
  action      text not null,
  target_type text not null,
  target_id   uuid,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_log_actor    on public.audit_log(actor_id);
create index audit_log_action   on public.audit_log(action);
create index audit_log_created  on public.audit_log(created_at);

alter table public.audit_log enable row level security;

-- only readable by responsable
create policy "audit_log: responsable read"
  on public.audit_log for select
  using ((auth.jwt() ->> 'app_role')::staff_role = 'responsable');

create policy "audit_log: no direct write"
  on public.audit_log for all
  using (false)
  with check (false);

-- ============================================================
-- WEEK FUNCTIONS (Saturday 04:00 Europe/Paris → Saturday 04:00)
-- ============================================================
create or replace function public.week_start(ts timestamptz default now())
returns timestamptz language plpgsql immutable as $$
declare
  local_ts  timestamp;
  dow       int;
  days_since_sat int;
  anchor    timestamp;
begin
  local_ts := ts at time zone 'Europe/Paris';
  dow := extract(dow from local_ts)::int;       -- 0=Sun … 6=Sat
  days_since_sat := (dow + 1) % 7;              -- 0 if Sat, 1 if Sun, …
  anchor := date_trunc('day', local_ts)
            - (days_since_sat || ' days')::interval
            + interval '4 hours';
  if anchor > local_ts then
    anchor := anchor - interval '7 days';
  end if;
  return anchor at time zone 'Europe/Paris';
end;
$$;

create or replace function public.week_end(ts timestamptz default now())
returns timestamptz language sql immutable as $$
  select public.week_start(ts) + interval '7 days';
$$;

-- ============================================================
-- CUSTOM ACCESS TOKEN HOOK
-- Enriches JWT with app_role from profiles.role
-- ============================================================
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb language plpgsql stable as $$
declare
  claims   jsonb;
  user_role staff_role;
begin
  select role into user_role
  from public.profiles
  where id = (event ->> 'user_id')::uuid;

  claims := event -> 'claims';

  if user_role is not null then
    claims := jsonb_set(claims, '{app_role}', to_jsonb(user_role::text));
  end if;

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;
