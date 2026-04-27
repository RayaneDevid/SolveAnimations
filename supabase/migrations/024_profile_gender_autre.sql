alter table profiles
  drop constraint if exists profiles_gender_check;

alter table profiles
  add constraint profiles_gender_check
  check (gender in ('homme', 'femme', 'autre'));
