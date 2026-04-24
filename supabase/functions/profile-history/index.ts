import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

// Returns recruitment + training history for a given profile_id.
// Used by the casier detail panel.
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireRole(profile, 'senior')
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const { profile_id } = body

  if (!profile_id) return errorResponse('VALIDATION_ERROR', 'profile_id requis')

  const db = getServiceClient()

  // Recruitment: find recruits linked to this profile
  const { data: recruits } = await db
    .from('recruitment_recruits')
    .select(`
      id, name, steam_id, created_at,
      session:recruitment_sessions(
        id, type, pole, created_at,
        recruiters:recruitment_recruiters(
          profile:profiles(id, username, avatar_url)
        )
      )
    `)
    .eq('profile_id', profile_id)
    .order('created_at', { ascending: false })

  // Training: find trainees linked to this profile
  const { data: trainees } = await db
    .from('training_trainees')
    .select(`
      id, name, steam_id, created_at,
      session:training_sessions(
        id, pole, created_at,
        trainers:training_trainers(
          profile:profiles(id, username, avatar_url)
        )
      )
    `)
    .eq('profile_id', profile_id)
    .order('created_at', { ascending: false })

  return jsonResponse({
    recruitments: recruits ?? [],
    trainings: trainees ?? [],
  })
})
