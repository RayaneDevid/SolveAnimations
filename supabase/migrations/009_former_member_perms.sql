alter table profiles
  add column if not exists ig_perms_removed      boolean not null default false,
  add column if not exists discord_perms_removed boolean not null default false;
