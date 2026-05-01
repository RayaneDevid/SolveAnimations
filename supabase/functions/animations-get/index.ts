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

  const { id } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: animation, error } = await db
    .from('animations')
    .select(`
      *,
      creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role, discord_id, gender)
    `)
    .eq('id', id)
    .single()

  if (error || !animation) return errorResponse('NOT_FOUND', 'Animation introuvable')

  const { data: participants } = await db
    .from('animation_participants')
    .select(`
      *,
      user:profiles!animation_participants_user_id_fkey(id, username, avatar_url, role, gender)
    `)
    .eq('animation_id', id)
    .neq('status', 'rejected')
    .order('applied_at', { ascending: true })

  const { data: deletionRequest } = await db
    .from('deletion_requests')
    .select('id, requested_by, requested_at, status')
    .eq('animation_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  const { data: timeCorrectionRequest } = await db
    .from('animation_time_correction_requests')
    .select(`
      id, requested_by, requested_at, requested_started_at,
      requested_actual_duration_min, requested_actual_prep_time_min,
      reason, status
    `)
    .eq('animation_id', id)
    .eq('status', 'pending')
    .maybeSingle()

  return jsonResponse({
    animation,
    participants: participants ?? [],
    deletionRequest: deletionRequest ?? null,
    timeCorrectionRequest: timeCorrectionRequest ?? null,
  })
})
