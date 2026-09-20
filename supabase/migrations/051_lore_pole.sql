-- ============================================================
-- Pôle Lore — mirrors the MJ pôle everywhere except les paies
-- (aucun pay_pole 'lore' : le pôle Lore n'entre pas dans les paies).
-- ============================================================

-- Les contraintes check ci-dessous ont été créées en inline (`check (...)` sur
-- la colonne), donc leur nom est auto-généré. On les retrouve par la colonne
-- qu'elles contraignent plutôt que par un nom deviné : si le nom ne
-- correspondait pas, un simple `drop constraint if exists` serait un no-op
-- silencieux et l'ancienne contrainte continuerait de rejeter 'lore'.
create or replace function pg_temp.drop_column_checks(tbl regclass, col text)
returns void language plpgsql as $$
declare
  c record;
begin
  for c in
    select con.conname
    from   pg_constraint con
    join   pg_attribute  att
      on   att.attrelid = con.conrelid
     and   att.attnum   = any (con.conkey)
    where  con.conrelid = tbl
      and  con.contype  = 'c'
      and  att.attname  = col
  loop
    execute format('alter table %s drop constraint %I', tbl::text, c.conname);
  end loop;
end;
$$;

-- ─── Pôle d'une animation ────────────────────────────────────
select pg_temp.drop_column_checks('animations', 'pole');
alter table animations
  add constraint animations_pole_check
  check (pole in ('animation', 'mj', 'lore', 'les_deux'));

-- ─── Destination d'une requête (RA / RMJ / RLore) ────────────
select pg_temp.drop_column_checks('requetes', 'destination');
alter table requetes
  add constraint requetes_destination_check
  check (destination in ('ra', 'rmj', 'rlore'));

-- ─── Audience d'une annonce ──────────────────────────────────
select pg_temp.drop_column_checks('public.broadcasts', 'audience');
alter table public.broadcasts
  add constraint broadcasts_audience_check
  check (audience in ('all', 'selected', 'pole_animation', 'pole_mj', 'pole_lore', 'pole_bdm'));

-- ─── Pôle d'une session de recrutement / formation ───────────
select pg_temp.drop_column_checks('recruitment_sessions', 'pole');
alter table recruitment_sessions
  add constraint recruitment_sessions_pole_check
  check (pole in ('mj', 'animation', 'lore'));

select pg_temp.drop_column_checks('training_sessions', 'pole');
alter table training_sessions
  add constraint training_sessions_pole_check
  check (pole in ('mj', 'animation', 'lore'));

-- ─── RLS : responsable_lore lit comme les autres responsables ─
drop policy if exists "reports: responsable read all" on public.animation_reports;
create policy "reports: responsable read all"
  on public.animation_reports for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj', 'responsable_lore', 'direction', 'gerance')
  );

drop policy if exists "absences: responsable read all" on public.user_absences;
create policy "absences: responsable read all"
  on public.user_absences for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj', 'responsable_lore', 'direction', 'gerance')
    or auth.uid() = user_id
  );

drop policy if exists "audit_log: responsable read" on public.audit_log;
create policy "audit_log: responsable read"
  on public.audit_log for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj', 'responsable_lore', 'direction', 'gerance')
  );
