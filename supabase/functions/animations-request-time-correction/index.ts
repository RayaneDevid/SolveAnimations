import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const REQUESTABLE_STATUSES = ['open', 'preparing', 'running', 'finished']

function intInRange(value: unknown, min: number, max: number): number | null {
  const n = Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return null
  return n
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json().catch(() => ({}))
  const {
    animation_id,
    requested_started_at,
    requested_actual_duration_min,
    requested_actual_prep_time_min = 0,
    reason,
  } = body

  if (!animation_id) return errorResponse('VALIDATION_ERROR', 'animation_id requis')

  const startedAt = new Date(requested_started_at)
  if (!requested_started_at || Number.isNaN(startedAt.getTime())) {
    return errorResponse('VALIDATION_ERROR', 'Date de début invalide')
  }
  if (startedAt.getTime() > Date.now()) {
    return errorResponse('VALIDATION_ERROR', 'La date de début ne peut pas être dans le futur')
  }

  const actualDurationMin = intInRange(requested_actual_duration_min, 1, 720)
  if (actualDurationMin == null) {
    return errorResponse('VALIDATION_ERROR', 'Durée animation invalide')
  }
  const actualPrepTimeMin = intInRange(requested_actual_prep_time_min, 0, 600)
  if (actualPrepTimeMin == null) {
    return errorResponse('VALIDATION_ERROR', 'Durée de préparation invalide')
  }
  if (startedAt.getTime() + actualDurationMin * 60_000 > Date.now() + 60_000) {
    return errorResponse('VALIDATION_ERROR', 'La fin demandée ne peut pas être dans le futur')
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
  if (trimmedReason.length > 500) {
    return errorResponse('VALIDATION_ERROR', 'Le motif ne peut pas dépasser 500 caractères')
  }

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('id, title, status, creator_id')
    .eq('id', animation_id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.creator_id !== profile.id) {
    return errorResponse('FORBIDDEN', 'Seul le créateur peut demander une correction de temps')
  }
  if (!REQUESTABLE_STATUSES.includes(anim.status)) {
    return errorResponse('CONFLICT', 'Cette animation ne peut pas recevoir de correction de temps')
  }

  const { data: existing } = await db
    .from('animation_time_correction_requests')
    .select('id')
    .eq('animation_id', animation_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return errorResponse('CONFLICT', 'Une demande de correction de temps est déjà en cours pour cette animation')
  }

  const { data: request, error } = await db
    .from('animation_time_correction_requests')
    .insert({
      animation_id,
      requested_by: profile.id,
      requested_started_at: startedAt.toISOString(),
      requested_actual_duration_min: actualDurationMin,
      requested_actual_prep_time_min: actualPrepTimeMin,
      reason: trimmedReason || null,
    })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.request_time_correction',
    target_type: 'animation',
    target_id: animation_id,
    metadata: {
      title: anim.title,
      status: anim.status,
      requested_started_at: startedAt.toISOString(),
      requested_actual_duration_min: actualDurationMin,
      requested_actual_prep_time_min: actualPrepTimeMin,
    },
  })

  return jsonResponse({ request })
})
