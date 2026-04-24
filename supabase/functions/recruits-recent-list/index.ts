import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

// Returns distinct recent recruits (last 3 months) for the formation form autocomplete.
// Optionally filtered by pole.
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireRole(profile, 'senior')
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const { pole } = body

  const db = getServiceClient()

  const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()

  let query = db
    .from('recruitment_recruits')
    .select('id, steam_id, name, profile_id, session_id, recruitment_sessions!inner(pole, created_at)')
    .gte('recruitment_sessions.created_at' as never, threeMonthsAgo)
    .order('created_at', { ascending: false })

  if (pole && ['mj', 'animation'].includes(pole)) {
    query = query.eq('recruitment_sessions.pole' as never, pole)
  }

  const { data, error } = await query

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  // Deduplicate by steam_id, keep most recent
  const seen = new Map<string, unknown>()
  for (const r of data ?? []) {
    if (!seen.has(r.steam_id)) seen.set(r.steam_id, r)
  }

  return jsonResponse(Array.from(seen.values()))
})
