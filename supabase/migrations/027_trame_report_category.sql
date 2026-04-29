alter table trame_reports
  add column if not exists category text not null default 'autre'
  check (category in ('clan', 'hors_clan', 'lore', 'bdm', 'autre'));
