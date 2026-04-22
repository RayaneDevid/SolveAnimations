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

  const { id } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.creator_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Seul le créateur peut arrêter la préparation')
  if (anim.status !== 'preparing')
    return errorResponse('CONFLICT', "L'animation n'est pas en cours de préparation")

  const now = new Date()
  const prepStart = new Date(anim.prep_started_at)
  const actualPrepMin = Math.max(1, Math.floor((now.getTime() - prepStart.getTime()) / 60_000))

  const { data: updated, error } = await db
    .from('animations')
    .update({
      status: 'open',
      prep_ended_at: now.toISOString(),
      actual_prep_time_min: actualPrepMin,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ animation: updated })
})
