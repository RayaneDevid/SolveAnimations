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

  const db = getServiceClient()

  const { data: sessions, error } = await db
    .from('training_sessions')
    .select(`
      id, pole, created_at,
      created_by_profile:profiles!created_by(username, avatar_url),
      trainers:training_trainers(
        profile:profiles(id, username, avatar_url)
      ),
      trainees:training_trainees(id, steam_id, name, profile_id,
        profile:profiles(username, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(sessions ?? [])
})
