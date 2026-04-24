import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

interface TraineeInput {
  steam_id: string
  name: string
}

interface Body {
  pole: 'mj' | 'animation'
  trainer_ids: string[]
  trainees: TraineeInput[]
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireRole(profile, 'senior')
  if (guard) return guard

  const body: Body = await req.json().catch(() => ({}))
  const { pole, trainer_ids, trainees } = body

  if (!['mj', 'animation'].includes(pole))
    return errorResponse('VALIDATION_ERROR', 'pole doit être mj ou animation')
  if (!Array.isArray(trainer_ids) || trainer_ids.length === 0)
    return errorResponse('VALIDATION_ERROR', 'Au moins un formateur requis')
  if (!Array.isArray(trainees) || trainees.length === 0)
    return errorResponse('VALIDATION_ERROR', 'Au moins un stagiaire requis')

  const db = getServiceClient()

  // Create session
  const { data: session, error: sessionError } = await db
    .from('training_sessions')
    .insert({ pole, created_by: profile.id })
    .select('id')
    .single()

  if (sessionError || !session) return errorResponse('INTERNAL_ERROR', sessionError?.message ?? 'Session création échouée')

  // Insert trainers
  await db.from('training_trainers').insert(
    trainer_ids.map((user_id: string) => ({ session_id: session.id, user_id }))
  )

  // Insert trainees; auto-link by steam_id
  const steamIds = trainees.map((t) => t.steam_id)
  const { data: existingProfiles } = await db
    .from('profiles')
    .select('id, steam_id')
    .in('steam_id', steamIds)

  const steamToProfileId = new Map<string, string>()
  for (const p of existingProfiles ?? []) {
    if (p.steam_id) steamToProfileId.set(p.steam_id, p.id)
  }

  await db.from('training_trainees').insert(
    trainees.map((t) => ({
      session_id: session.id,
      steam_id: t.steam_id,
      name: t.name,
      profile_id: steamToProfileId.get(t.steam_id) ?? null,
    }))
  )

  return jsonResponse({ id: session.id })
})
