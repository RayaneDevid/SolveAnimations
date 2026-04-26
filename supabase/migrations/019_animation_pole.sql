alter table animations
  add column pole text not null default 'animation'
  check (pole in ('animation', 'mj', 'les_deux'));
