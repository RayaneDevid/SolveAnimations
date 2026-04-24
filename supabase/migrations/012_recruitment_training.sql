-- ─── Recrutement ─────────────────────────────────────────────────────────────

create table if not exists recruitment_sessions (
  id         uuid        primary key default gen_random_uuid(),
  type       text        not null check (type in ('ecrit', 'oral')),
  pole       text        not null check (pole in ('mj', 'animation')),
  created_by uuid        references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists recruitment_recruiters (
  session_id uuid references recruitment_sessions(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  primary key (session_id, user_id)
);

create table if not exists recruitment_recruits (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references recruitment_sessions(id) on delete cascade,
  steam_id   text        not null,
  name       text        not null,
  profile_id uuid        references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Formation ───────────────────────────────────────────────────────────────

create table if not exists training_sessions (
  id         uuid        primary key default gen_random_uuid(),
  pole       text        not null check (pole in ('mj', 'animation')),
  created_by uuid        references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists training_trainers (
  session_id uuid references training_sessions(id) on delete cascade,
  user_id    uuid references profiles(id) on delete cascade,
  primary key (session_id, user_id)
);

create table if not exists training_trainees (
  id         uuid        primary key default gen_random_uuid(),
  session_id uuid        not null references training_sessions(id) on delete cascade,
  steam_id   text        not null,
  name       text        not null,
  profile_id uuid        references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

-- ─── Auto-link steam_id ───────────────────────────────────────────────────────
-- Quand un profil renseigne son steam_id, on cherche des recrues/stagiaires
-- non encore liés avec ce même steam_id et on les rattache.

create or replace function link_profile_steam_id()
returns trigger language plpgsql as $$
begin
  if NEW.steam_id is not null then
    update recruitment_recruits
    set    profile_id = NEW.id
    where  steam_id   = NEW.steam_id
      and  profile_id is null;

    update training_trainees
    set    profile_id = NEW.id
    where  steam_id   = NEW.steam_id
      and  profile_id is null;
  end if;
  return NEW;
end;
$$;

create trigger profiles_steam_id_autolink
after insert or update of steam_id on profiles
for each row execute function link_profile_steam_id();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table recruitment_sessions  enable row level security;
alter table recruitment_recruiters enable row level security;
alter table recruitment_recruits   enable row level security;
alter table training_sessions      enable row level security;
alter table training_trainers      enable row level security;
alter table training_trainees      enable row level security;

-- Service role (Edge Functions) a accès total ; le frontend passe par les EF.
-- On ne crée pas de policies permissives pour anon/authenticated : toutes les
-- lectures/écritures se font via service role dans les Edge Functions.
