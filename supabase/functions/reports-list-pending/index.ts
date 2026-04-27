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

  const { data: reports, error } = await db
    .from('animation_reports')
    .select(`
      *,
      user:profiles!animation_reports_user_id_fkey(id, username, avatar_url, role),
      animation:animations!animation_reports_animation_id_fkey(
        id, title, village, scheduled_at, planned_duration_min, actual_duration_min, prep_time_min, actual_prep_time_min, status, server, type
      )
    `)
    .is('submitted_at', null)
    .order('created_at', { ascending: true })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(reports ?? [])
})
