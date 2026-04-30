-- Nettoie les rapports qui appartiennent à des utilisateurs retirés d'une animation.
-- Le créateur reste considéré comme présent, même sans ligne dans animation_participants.
delete from public.animation_reports as report
using public.animations as animation
where animation.id = report.animation_id
  and report.user_id <> animation.creator_id
  and not exists (
    select 1
    from public.animation_participants as participant
    where participant.animation_id = report.animation_id
      and participant.user_id = report.user_id
      and participant.status = 'validated'::participant_status
  );
