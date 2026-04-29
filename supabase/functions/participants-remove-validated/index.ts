import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { participant_id } = await req.json()
  if (!participant_id) return errorResponse('VALIDATION_ERROR', 'participant_id requis')

  const db = getServiceClient()

  const { data: participant } = await db
    .from('animation_participants')
    .select('*, animation:animations!animation_participants_animation_id_fkey(creator_id, status)')
    .eq('id', participant_id)
    .single()

  if (!participant) return errorResponse('NOT_FOUND', 'Participant introuvable')

  const isCreator = participant.animation?.creator_id === profile.id
  const isSelf = participant.user_id === profile.id
  const isResponsable = isResponsableRole(profile)
  if (!isCreator && !isSelf && !isResponsable)
    return errorResponse('FORBIDDEN', 'Seul le créateur, le participant lui-même ou un responsable peut le retirer')

  if (!isResponsable && !['open', 'preparing', 'running'].includes(participant.animation?.status ?? ''))
    return errorResponse('CONFLICT', "L'animation doit être ouverte, en débrief ou en cours")
  if (!['pending', 'validated'].includes(participant.status))
    return errorResponse('CONFLICT', 'Ce participant ne peut pas être retiré')

  const { data: updated, error } = await db
    .from('animation_participants')
    .update({
      status: 'removed',
      decided_at: new Date().toISOString(),
      decided_by: profile.id,
    })
    .eq('id', participant_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, participant.animation_id)

  return jsonResponse({ participant: updated })
})
