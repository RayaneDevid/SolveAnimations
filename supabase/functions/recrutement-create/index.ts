import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

interface RecruitInput {
  steam_id: string
  name: string
}

interface Body {
  type: 'ecrit' | 'oral'
  pole: 'mj' | 'animation'
  recruiter_ids: string[]
  recruits: RecruitInput[]
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireRole(profile, 'senior')
  if (guard) return guard

  const body: Body = await req.json().catch(() => ({}))
  const { type, pole, recruiter_ids, recruits } = body

  if (!['ecrit', 'oral'].includes(type))
    return errorResponse('VALIDATION_ERROR', 'type doit être ecrit ou oral')
  if (!['mj', 'animation'].includes(pole))
    return errorResponse('VALIDATION_ERROR', 'pole doit être mj ou animation')
  if (!Array.isArray(recruiter_ids) || recruiter_ids.length === 0)
    return errorResponse('VALIDATION_ERROR', 'Au moins un formateur requis')
  if (!Array.isArray(recruits) || recruits.length === 0)
    return errorResponse('VALIDATION_ERROR', 'Au moins une recrue requise')

  const db = getServiceClient()

  // Create session
  const { data: session, error: sessionError } = await db
    .from('recruitment_sessions')
    .insert({ type, pole, created_by: profile.id })
    .select('id')
    .single()

  if (sessionError || !session) return errorResponse('INTERNAL_ERROR', sessionError?.message ?? 'Session création échouée')

  // Insert recruiters
  await db.from('recruitment_recruiters').insert(
    recruiter_ids.map((user_id: string) => ({ session_id: session.id, user_id }))
  )

  // Insert recruits; try to auto-link existing profiles by steam_id
  const steamIds = recruits.map((r) => r.steam_id)
  const { data: existingProfiles } = await db
    .from('profiles')
    .select('id, steam_id')
    .in('steam_id', steamIds)

  const steamToProfileId = new Map<string, string>()
  for (const p of existingProfiles ?? []) {
    if (p.steam_id) steamToProfileId.set(p.steam_id, p.id)
  }

  await db.from('recruitment_recruits').insert(
    recruits.map((r) => ({
      session_id: session.id,
      steam_id: r.steam_id,
      name: r.name,
      profile_id: steamToProfileId.get(r.steam_id) ?? null,
    }))
  )

  return jsonResponse({ id: session.id })
})
