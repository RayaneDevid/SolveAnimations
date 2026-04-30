alter table profiles
  add column if not exists discord_username text;

update profiles
set discord_username = username
where discord_username is null;
