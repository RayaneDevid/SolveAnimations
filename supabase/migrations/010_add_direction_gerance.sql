-- Add Direction and Gérance roles (above all existing roles)
alter type staff_role add value 'direction';
alter type staff_role add value 'gerance';

-- Update RLS policies that restrict to responsable roles
-- (reports)
drop policy if exists "reports: responsable read all" on public.animation_reports;
create policy "reports: responsable read all"
  on public.animation_reports for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj', 'direction', 'gerance')
  );

-- (absences)
drop policy if exists "absences: responsable read all" on public.user_absences;
create policy "absences: responsable read all"
  on public.user_absences for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj', 'direction', 'gerance')
    or auth.uid() = user_id
  );

-- (audit_log)
drop policy if exists "audit_log: responsable read" on public.audit_log;
create policy "audit_log: responsable read"
  on public.audit_log for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj', 'direction', 'gerance')
  );
