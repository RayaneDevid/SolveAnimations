alter table public.animations
  add column registrations_locked boolean not null default false;
