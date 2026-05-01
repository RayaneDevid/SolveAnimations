import { notifyBot } from './bot.ts'

// deno-lint-ignore no-explicit-any
export async function syncEmbed(db: any, animationId: string): Promise<void> {
  const { data: anim } = await db
    .from('animations')
    .select('*, creator:profiles!animations_creator_id_fkey(username)')
    .eq('id', animationId)
    .single()

  if (!anim?.discord_message_id) return
  if (anim.status === 'pending_validation') return

  const { count } = await db
    .from('animation_participants')
    .select('*', { count: 'exact', head: true })
    .eq('animation_id', animationId)
    .eq('status', 'validated')

  await notifyBot('animation-embed-refresh', {
    animationId,
    publicMessageId: anim.discord_message_id,
    title: anim.title,
    scheduledAt: anim.scheduled_at,
    plannedDurationMin: anim.planned_duration_min,
    prepTimeMin: anim.prep_time_min,
    server: anim.server,
    type: anim.type,
    village: anim.village,
    documentUrl: anim.document_url,
    creatorUsername: anim.creator?.username ?? 'Inconnu',
    requiredParticipants: anim.required_participants,
    registrationsLocked: anim.registrations_locked,
    currentParticipants: count ?? 0,
    status: anim.status,
    actualDurationMin: anim.actual_duration_min ?? undefined,
  })
}
