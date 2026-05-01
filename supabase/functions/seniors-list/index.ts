import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

// Returns all active profiles with role >= senior (for recruiter/trainer multi-select).
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireRole(profile, 'senior')
  if (guard) return guard

  const db = getServiceClient()

  const SENIOR_ROLES = ['direction', 'gerance', 'responsable', 'responsable_mj', 'senior', 'mj_senior']

  const { data, error } = await db
    .from('profiles')
    .select('id, username, avatar_url, role')
    .eq('is_active', true)
    .overlaps('available_roles', SENIOR_ROLES)
    .order('username', { ascending: true })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(data ?? [])
})
