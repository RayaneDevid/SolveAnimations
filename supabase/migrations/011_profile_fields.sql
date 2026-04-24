alter table profiles
  add column if not exists steam_id    text,
  add column if not exists arrival_date date,
  add column if not exists contact_email text;
