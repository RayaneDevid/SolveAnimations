import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
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
    .select('*, animation:animations!animation_participants_animation_id_fkey(id, status, started_at, ended_at)')
    .eq('id', participant_id)
    .single()

  if (!participant) return errorResponse('NOT_FOUND', 'Participant introuvable')
  if (participant.user_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Tu ne peux terminer que ta propre participation')
  if (participant.status !== 'validated')
    return errorResponse('CONFLICT', 'Seule une participation validée peut être terminée')
  if (participant.participation_ended_at)
    return errorResponse('CONFLICT', 'Participation déjà terminée')
  if (participant.animation?.status !== 'running' || !participant.animation?.started_at)
    return errorResponse('CONFLICT', "L'animation doit être en cours")

  const now = new Date().toISOString()
  const startedAt = new Date(participant.animation.started_at).getTime()
  const finishedAt = Math.max(startedAt, new Date(now).getTime())

  const { data: updated, error } = await db
    .from('animation_participants')
    .update({ participation_ended_at: new Date(finishedAt).toISOString() })
    .eq('id', participant_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, participant.animation_id)

  return jsonResponse({ participant: updated })
})

