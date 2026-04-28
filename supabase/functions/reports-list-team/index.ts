import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireRole(profile, 'senior')
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const from = typeof body.from === 'string' ? new Date(body.from) : null
  const to = typeof body.to === 'string' ? new Date(body.to) : null

  if (from && Number.isNaN(from.getTime())) return errorResponse('VALIDATION_ERROR', 'Date de début invalide')
  if (to && Number.isNaN(to.getTime())) return errorResponse('VALIDATION_ERROR', 'Date de fin invalide')

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
    .order('created_at', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  const filtered = (reports ?? []).filter((report) => {
    const scheduledAt = report.animation?.scheduled_at
    if (!scheduledAt) return false
    const ts = new Date(scheduledAt).getTime()
    if (from && ts < from.getTime()) return false
    if (to && ts >= to.getTime()) return false
    return true
  })

  return jsonResponse(filtered)
})
