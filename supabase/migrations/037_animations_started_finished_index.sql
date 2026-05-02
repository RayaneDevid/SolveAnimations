create index if not exists animations_started_finished
  on public.animations(started_at)
  where status = 'finished';
