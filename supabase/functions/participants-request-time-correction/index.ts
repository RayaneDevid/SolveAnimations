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

  const { participant_id, requested_joined_at, reason } = await req.json().catch(() => ({}))
  if (!participant_id) return errorResponse('VALIDATION_ERROR', 'participant_id requis')

  const requestedJoinedAt = new Date(requested_joined_at)
  if (!requested_joined_at || Number.isNaN(requestedJoinedAt.getTime())) {
    return errorResponse('VALIDATION_ERROR', "Heure d'inscription invalide")
  }
  if (requestedJoinedAt.getTime() > Date.now()) {
    return errorResponse('VALIDATION_ERROR', "L'heure demandée ne peut pas être dans le futur")
  }

  const trimmedReason = typeof reason === 'string' ? reason.trim() : ''
  if (trimmedReason.length > 500) {
    return errorResponse('VALIDATION_ERROR', 'Le motif ne peut pas dépasser 500 caractères')
  }

  const db = getServiceClient()

  const { data: participant } = await db
    .from('animation_participants')
    .select(`
      id, animation_id, user_id, status, joined_at, participation_ended_at,
      animation:animations!animation_participants_animation_id_fkey(
        id, title, status, started_at, ended_at
      )
    `)
    .eq('id', participant_id)
    .single()

  if (!participant) return errorResponse('NOT_FOUND', 'Participation introuvable')
  if (participant.user_id !== profile.id) {
    return errorResponse('FORBIDDEN', 'Seul le participant peut demander cette correction')
  }
  if (participant.status !== 'validated') {
    return errorResponse('CONFLICT', 'La participation doit être validée')
  }

  const animation = participant.animation as {
    id: string
    title: string
    status: string
    started_at: string | null
    ended_at: string | null
  } | null
  if (!animation) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (animation.status !== 'finished' || !animation.started_at || !animation.ended_at) {
    return errorResponse('CONFLICT', "L'animation doit être terminée")
  }

  const startedAt = new Date(animation.started_at)
  const endedAt = new Date(participant.participation_ended_at ?? animation.ended_at)
  if (requestedJoinedAt.getTime() < startedAt.getTime() || requestedJoinedAt.getTime() > endedAt.getTime()) {
    return errorResponse('VALIDATION_ERROR', "L'heure demandée doit être comprise dans la durée de présence")
  }

  const currentJoinedAt = participant.joined_at ? new Date(participant.joined_at) : null
  if (currentJoinedAt && Math.abs(requestedJoinedAt.getTime() - currentJoinedAt.getTime()) < 60_000) {
    return errorResponse('VALIDATION_ERROR', "L'heure demandée est déjà celle enregistrée")
  }

  const { data: existing } = await db
    .from('participant_time_correction_requests')
    .select('id')
    .eq('participant_id', participant_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing) {
    return errorResponse('CONFLICT', "Une demande de correction d'inscription est déjà en cours")
  }

  const { data: request, error } = await db
    .from('participant_time_correction_requests')
    .insert({
      animation_id: participant.animation_id,
      participant_id,
      requested_by: profile.id,
      current_joined_at: participant.joined_at,
      requested_joined_at: requestedJoinedAt.toISOString(),
      reason: trimmedReason || null,
    })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'participant.request_time_correction',
    target_type: 'animation_participant',
    target_id: participant_id,
    metadata: {
      animation_id: participant.animation_id,
      title: animation.title,
      current_joined_at: participant.joined_at,
      requested_joined_at: requestedJoinedAt.toISOString(),
    },
  })

  return jsonResponse({ request })
})
