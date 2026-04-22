-- audit_log.actor_id must SET NULL on profile deletion
-- (preserves audit history while allowing members-remove-access to complete)
alter table public.audit_log
  drop constraint audit_log_actor_id_fkey,
  add constraint audit_log_actor_id_fkey
    foreign key (actor_id) references public.profiles(id) on delete set null;
