alter table profiles
  add column if not exists gender text check (gender in ('homme', 'femme'));
