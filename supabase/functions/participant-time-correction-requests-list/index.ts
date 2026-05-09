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

  const db = getServiceClient()

  const { data: requests, error } = await db
    .from('participant_time_correction_requests')
    .select(`
      *,
      animation:animations(
        id, title, status, scheduled_at, started_at, ended_at,
        actual_duration_min, planned_duration_min, server, village, type
      ),
      requester:profiles!participant_time_correction_requests_requested_by_fkey(id, username, avatar_url, role),
      participant:animation_participants(
        id, user_id, joined_at, participation_ended_at,
        user:profiles!animation_participants_user_id_fkey(id, username, avatar_url, role)
      )
    `)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ requests: requests ?? [] })
})
