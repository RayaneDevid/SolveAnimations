-- Past animations created retroactively could store participant joined_at at the
-- creation/validation time. If that timestamp is after the finished animation,
-- credit the participant from the real animation start instead.
update public.animation_participants ap
set joined_at = a.started_at,
    participation_ended_at = null
from public.animations a
where ap.animation_id = a.id
  and ap.status = 'validated'
  and a.status = 'finished'
  and a.started_at is not null
  and a.ended_at is not null
  and ap.joined_at is not null
  and ap.joined_at > a.ended_at;
