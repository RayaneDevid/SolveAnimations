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
    return errorResponse('CONFLICT', "L'animation doit être en cours pour reprendre le chrono")
  if (!anim.pause_started_at)
    return errorResponse('CONFLICT', "Le chrono n'est pas en pause")

  const now = new Date()
  const pauseStartedAt = new Date(anim.pause_started_at)
  const pauseMin = Math.max(0, Math.floor((now.getTime() - pauseStartedAt.getTime()) / 60_000))
  const pausedDurationMin = Math.max(0, Number(anim.paused_duration_min ?? 0)) + pauseMin

  const { data: updated, error } = await db
    .from('animations')
    .update({
      pause_started_at: null,
      paused_duration_min: pausedDurationMin,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, id)

  return jsonResponse({ animation: updated })
})

