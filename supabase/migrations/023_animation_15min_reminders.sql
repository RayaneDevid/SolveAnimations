alter table animations
  add column if not exists reminder_15min_sent_at timestamptz null;

create index if not exists idx_animations_reminder_15min
  on animations(status, scheduled_at)
  where reminder_15min_sent_at is null;
