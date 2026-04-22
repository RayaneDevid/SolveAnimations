import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { participant_id, character_name } = await req.json()
  if (!participant_id) return errorResponse('VALIDATION_ERROR', 'participant_id requis')
  if (!character_name || character_name.trim().length === 0)
    return errorResponse('VALIDATION_ERROR', 'Nom requis')

  const db = getServiceClient()

  const { data: participant } = await db
    .from('animation_participants')
    .select('*')
    .eq('id', participant_id)
    .single()

  if (!participant) return errorResponse('NOT_FOUND', 'Participant introuvable')
  if (participant.user_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Tu ne peux modifier que ton propre personnage')

  const { data: updated, error } = await db
    .from('animation_participants')
    .update({ character_name: character_name.trim() })
    .eq('id', participant_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ participant: updated })
})
