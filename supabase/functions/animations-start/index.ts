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
  if (!['open', 'preparing'].includes(anim.status))
    return errorResponse('CONFLICT', "L'animation doit être ouverte pour être démarrée")

  const now = new Date()
  const startedAt = now.toISOString()
  const updateData: Record<string, unknown> = {
    status: 'running',
    scheduled_at: startedAt,
    started_at: startedAt,
  }

  // Auto-close debrief if still running when animation starts
  if (anim.prep_started_at && !anim.prep_ended_at) {
    const prepStart = new Date(anim.prep_started_at)
    updateData.prep_ended_at = startedAt
    updateData.actual_prep_time_min = Math.max(1, Math.floor((now.getTime() - prepStart.getTime()) / 60_000))
  }

  const { data: updated, error } = await db
    .from('animations')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, id)

  return jsonResponse({ animation: updated })
})
