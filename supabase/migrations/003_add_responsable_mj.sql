-- ============================================================
-- Add responsable_mj role — same privileges as responsable
-- ============================================================

alter type staff_role add value 'responsable_mj';

-- RLS policies that previously allowed only 'responsable' must also allow 'responsable_mj'.
-- We drop and recreate each of the three affected policies.

-- reports
drop policy "reports: responsable read all" on public.animation_reports;
create policy "reports: responsable read all"
  on public.animation_reports for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj')
  );

-- absences
drop policy "absences: responsable read all" on public.user_absences;
create policy "absences: responsable read all"
  on public.user_absences for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj')
  );

-- audit_log
drop policy "audit_log: responsable read" on public.audit_log;
create policy "audit_log: responsable read"
  on public.audit_log for select
  using (
    (auth.jwt() ->> 'app_role')::text in ('responsable', 'responsable_mj')
  );
