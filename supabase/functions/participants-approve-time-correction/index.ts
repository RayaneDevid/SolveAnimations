import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { request_id } = await req.json().catch(() => ({}))
  if (!request_id) return errorResponse('VALIDATION_ERROR', 'request_id requis')

  const db = getServiceClient()

  const { data: request } = await db
    .from('participant_time_correction_requests')
    .select(`
      *,
      participant:animation_participants(
        id, user_id, status, joined_at, participation_ended_at
      ),
      animation:animations(
        id, title, status, started_at, ended_at
      )
    `)
    .eq('id', request_id)
    .eq('status', 'pending')
    .single()

  if (!request) return errorResponse('NOT_FOUND', 'Demande introuvable ou déjà traitée')

  const participant = request.participant as {
    id: string
    status: string
    joined_at: string | null
    participation_ended_at: string | null
  } | null
  const animation = request.animation as {
    id: string
    title: string
    status: string
    started_at: string | null
    ended_at: string | null
  } | null
  if (!participant) return errorResponse('NOT_FOUND', 'Participation introuvable')
  if (!animation) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (participant.status !== 'validated') return errorResponse('CONFLICT', 'La participation doit être validée')
  if (animation.status !== 'finished' || !animation.started_at || !animation.ended_at) {
    return errorResponse('CONFLICT', "L'animation doit être terminée")
  }

  const requestedJoinedAt = new Date(request.requested_joined_at)
  const startedAt = new Date(animation.started_at)
  const endedAt = new Date(participant.participation_ended_at ?? animation.ended_at)
  if (
    Number.isNaN(requestedJoinedAt.getTime()) ||
    requestedJoinedAt.getTime() < startedAt.getTime() ||
    requestedJoinedAt.getTime() > endedAt.getTime()
  ) {
    return errorResponse('VALIDATION_ERROR', "L'heure demandée doit être comprise dans la durée de présence")
  }

  const { data: updated, error } = await db
    .from('animation_participants')
    .update({ joined_at: requestedJoinedAt.toISOString() })
    .eq('id', request.participant_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db
    .from('participant_time_correction_requests')
    .update({ status: 'approved', decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', request.id)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'participant.approve_time_correction',
    target_type: 'animation_participant',
    target_id: request.participant_id,
    metadata: {
      request_id,
      animation_id: request.animation_id,
      previous_joined_at: participant.joined_at,
      requested_joined_at: requestedJoinedAt.toISOString(),
    },
  })

  return jsonResponse({ participant: updated })
})
