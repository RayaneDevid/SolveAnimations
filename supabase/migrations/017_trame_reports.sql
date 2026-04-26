-- ─── Rapports trames ─────────────────────────────────────────────────────────

create table if not exists trame_reports (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null check (length(trim(title)) >= 3 and length(title) <= 120),
  document_url text        not null,
  author_id    uuid        not null references profiles(id) on delete cascade,
  created_at   timestamptz not null default now()
);

create table if not exists trame_report_co_authors (
  report_id uuid not null references trame_reports(id) on delete cascade,
  user_id   uuid not null references profiles(id) on delete cascade,
  primary key (report_id, user_id)
);

create index if not exists idx_trame_reports_author  on trame_reports(author_id);
create index if not exists idx_trame_reports_created on trame_reports(created_at desc);
create index if not exists idx_trame_co_authors_user on trame_report_co_authors(user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table trame_reports           enable row level security;
alter table trame_report_co_authors enable row level security;

-- Tout le staff peut lire
create policy "Staff can read trame_reports"
  on trame_reports for select
  to authenticated
  using (true);

create policy "Staff can read trame_report_co_authors"
  on trame_report_co_authors for select
  to authenticated
  using (true);

-- Les écritures passent uniquement par les edge functions (service role → bypass RLS)
