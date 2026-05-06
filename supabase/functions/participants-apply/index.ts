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

  const { animation_id } = await req.json()
  if (!animation_id) return errorResponse('VALIDATION_ERROR', 'animation_id requis')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('id, creator_id, status, scheduled_at, planned_duration_min, prep_time_min, registrations_locked')
    .eq('id', animation_id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (!['pending_validation', 'open', 'preparing', 'running'].includes(anim.status))
    return errorResponse('CONFLICT', "L'animation n'est pas ouverte aux inscriptions")
  if (anim.registrations_locked)
    return errorResponse('CONFLICT', 'Les inscriptions sont verrouillées pour cette animation')
  if (anim.creator_id === profile.id)
    return errorResponse('FORBIDDEN', 'Le créateur ne peut pas se proposer sur sa propre animation')

  // Check absence covering the animation date
  const animDate = anim.scheduled_at.split('T')[0]
  const { data: absence } = await db
    .from('user_absences')
    .select('id')
    .eq('user_id', profile.id)
    .lte('from_date', animDate)
    .gt('to_date', animDate)
    .limit(1)
    .maybeSingle()

  if (absence)
    return errorResponse('CONFLICT', 'Tu as une absence déclarée pour cette date')

  // Time-slot conflict: block if user is already creator or pending/validated participant
  // on another active animation whose [scheduled_at - prep, scheduled_at + planned] overlaps.
  const animStartMs = new Date(anim.scheduled_at).getTime() - (anim.prep_time_min ?? 0) * 60_000
  const animEndMs = new Date(anim.scheduled_at).getTime() + (anim.planned_duration_min ?? 0) * 60_000
  const windowFromIso = new Date(animStartMs - 24 * 3_600_000).toISOString()
  const windowToIso = new Date(animEndMs + 24 * 3_600_000).toISOString()
  const ACTIVE_STATUSES = ['pending_validation', 'open', 'preparing', 'running'] as const

  const [{ data: createdRows }, { data: participantRows }] = await Promise.all([
    db
      .from('animations')
      .select('id, title, scheduled_at, planned_duration_min, prep_time_min')
      .eq('creator_id', profile.id)
      .neq('id', animation_id)
      .in('status', ACTIVE_STATUSES as unknown as string[])
      .gte('scheduled_at', windowFromIso)
      .lt('scheduled_at', windowToIso),
    db
      .from('animation_participants')
      .select('animations!inner(id, title, scheduled_at, planned_duration_min, prep_time_min, status)')
      .eq('user_id', profile.id)
      .in('status', ['pending', 'validated'])
      .neq('animation_id', animation_id)
      .in('animations.status' as never, ACTIVE_STATUSES as unknown as string[])
      .gte('animations.scheduled_at' as never, windowFromIso)
      .lt('animations.scheduled_at' as never, windowToIso),
  ])

  type CandidateAnim = { id: string; title: string; scheduled_at: string; planned_duration_min: number | null; prep_time_min: number | null }
  const candidates = new Map<string, CandidateAnim>()
  for (const row of (createdRows ?? []) as CandidateAnim[]) candidates.set(row.id, row)
  for (const row of (participantRows ?? []) as Array<{ animations: CandidateAnim }>) {
    if (row.animations) candidates.set(row.animations.id, row.animations)
  }

  const overlap = Array.from(candidates.values()).find((c) => {
    const cStart = new Date(c.scheduled_at).getTime() - (c.prep_time_min ?? 0) * 60_000
    const cEnd = new Date(c.scheduled_at).getTime() + (c.planned_duration_min ?? 0) * 60_000
    return cStart < animEndMs && cEnd > animStartMs
  })

  if (overlap)
    return errorResponse('CONFLICT', `Créneau déjà occupé par "${overlap.title}". Désinscris-toi avant de t'inscrire ailleurs.`)

  // Reactivate an existing row if already present (e.g. after self-withdraw or creator-kick)
  const { data: existing } = await db
    .from('animation_participants')
    .select('id, status')
    .eq('animation_id', animation_id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existing && ['pending', 'validated'].includes(existing.status))
    return errorResponse('CONFLICT', 'Tu es déjà inscrit à cette animation')

  const now = new Date().toISOString()

  if (existing) {
    const { data: participant, error } = await db
      .from('animation_participants')
      .update({
        status: 'validated',
        character_name: null,
        applied_at: now,
        decided_at: now,
        decided_by: profile.id,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)
    return jsonResponse({ participant }, 200)
  }

  const { data: participant, error } = await db
    .from('animation_participants')
    .insert({
      animation_id,
      user_id: profile.id,
      character_name: null,
      status: 'validated',
      decided_at: now,
      decided_by: profile.id,
    })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ participant }, 201)
})
