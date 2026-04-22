import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { id } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*, creator:profiles!animations_creator_id_fkey(discord_id, username)')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.status !== 'pending_validation')
    return errorResponse('CONFLICT', 'Animation non en attente de validation')

  const { data: updated, error } = await db
    .from('animations')
    .update({
      status: 'open',
      validated_by: profile.id,
      validated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  // Audit
  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.validate',
    target_type: 'animation',
    target_id: id,
    metadata: {},
  })

  const botRes = await notifyBot<{ data: { publicMessageId: string } }>('animation-validated', {
    animationId: id,
    creatorDiscordId: anim.creator?.discord_id,
    title: anim.title,
    scheduledAt: anim.scheduled_at,
    plannedDurationMin: anim.planned_duration_min,
    prepTimeMin: anim.prep_time_min,
    requiredParticipants: anim.required_participants,
    server: anim.server,
    village: anim.village,
    type: anim.type,
    documentUrl: anim.document_url,
    creatorUsername: anim.creator?.username,
    adminMessageId: anim.discord_message_id ?? undefined,
  })

  // Save the public announce message ID so start/stop/finished can edit the embed
  const publicMessageId = botRes?.data?.publicMessageId
  if (publicMessageId) {
    await db.from('animations').update({ discord_message_id: publicMessageId }).eq('id', id)
  }

  return jsonResponse({ animation: updated })
})
