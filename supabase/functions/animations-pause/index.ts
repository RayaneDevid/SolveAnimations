import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

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
  if (anim.creator_id !== profile.id) {
    const guard = requireRole(profile, 'senior')
    if (guard) return guard
  }
  if (anim.status !== 'running')
    return errorResponse('CONFLICT', "L'animation doit être en cours pour être mise en pause")
  if (anim.pause_started_at)
    return errorResponse('CONFLICT', 'Le chrono est déjà en pause')

  const { data: updated, error } = await db
    .from('animations')
    .update({ pause_started_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, id)

  return jsonResponse({ animation: updated })
})

