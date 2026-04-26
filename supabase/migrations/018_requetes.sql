-- ─── Requêtes (tickets) ───────────────────────────────────────────────────────

create table if not exists requetes (
  id              uuid        primary key default gen_random_uuid(),
  subject         text        not null check (subject in (
                                'grade_superieur_tkj',
                                'demande_give',
                                'setmodel_tenue',
                                'reservation_secteur',
                                'situation_problematique'
                              )),
  destination     text        not null check (destination in ('ra', 'rmj')),
  description     text        not null check (length(trim(description)) >= 10),
  creator_id      uuid        not null references profiles(id) on delete cascade,
  status          text        not null default 'pending'
                              check (status in ('pending', 'accepted', 'refused')),
  decided_by      uuid        references profiles(id) on delete set null,
  decided_at      timestamptz,
  decision_reason text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_requetes_creator           on requetes(creator_id);
create index if not exists idx_requetes_dest_status       on requetes(destination, status);
create index if not exists idx_requetes_created           on requetes(created_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

alter table requetes enable row level security;

-- Le créateur peut lire ses propres tickets
create policy "Creator can view own requetes"
  on requetes for select
  to authenticated
  using (creator_id = auth.uid());

-- Les écritures et lectures côté responsables passent par le service role (edge functions)
