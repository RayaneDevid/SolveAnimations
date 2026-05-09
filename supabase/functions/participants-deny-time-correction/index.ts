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
    .select('id, animation_id, participant_id')
    .eq('id', request_id)
    .eq('status', 'pending')
    .single()

  if (!request) return errorResponse('NOT_FOUND', 'Demande introuvable ou déjà traitée')

  await db
    .from('participant_time_correction_requests')
    .update({ status: 'denied', decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', request_id)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'participant.deny_time_correction',
    target_type: 'animation_participant',
    target_id: request.participant_id,
    metadata: { request_id, animation_id: request.animation_id },
  })

  return jsonResponse({ success: true })
})
