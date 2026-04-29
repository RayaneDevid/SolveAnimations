alter table profiles
  add column if not exists pay_pole text
  check (pay_pole in ('animation', 'mj'));
