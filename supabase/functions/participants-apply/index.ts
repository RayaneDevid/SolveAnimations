import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { animationSlotBounds, participantSlotBounds } from '../_shared/animationSlot.ts'

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
    .select('id, creator_id, status, scheduled_at, planned_duration_min, prep_time_min, actual_duration_min, actual_prep_time_min, started_at, ended_at, prep_started_at, registrations_locked')
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

  // Hard lock while the user is currently active in a running animation.
  // A running animation may exceed its planned slot, so overlap checks alone are not enough.
  const [{ data: runningCreated }, { data: runningParticipation }] = await Promise.all([
    db
      .from('animations')
      .select('id, title')
      .eq('creator_id', profile.id)
      .neq('id', animation_id)
      .eq('status', 'running')
      .limit(1)
      .maybeSingle(),
    db
      .from('animation_participants')
      .select('id, participation_ended_at, animation:animations!inner(id, title, status)')
      .eq('user_id', profile.id)
      .eq('status', 'validated')
      .neq('animation_id', animation_id)
      .is('participation_ended_at', null)
      .eq('animation.status' as never, 'running')
      .limit(1)
      .maybeSingle(),
  ])

  if (runningCreated) {
    return errorResponse('CONFLICT', `Tu dois d'abord terminer "${runningCreated.title}" avant de t'inscrire ailleurs.`)
  }
  if (runningParticipation?.animation) {
    return errorResponse('CONFLICT', `Clique sur "J'ai terminé !" sur "${runningParticipation.animation.title}" avant de t'inscrire ailleurs.`)
  }

  // Time-slot conflict: block if user is already creator or pending/validated participant
  // on another active animation whose real (chrono-based) slot overlaps.
  const { startMs: animStartMs, endMs: animEndMs } = animationSlotBounds(anim)
  const windowFromIso = new Date(animStartMs - 24 * 3_600_000).toISOString()
  const windowToIso = new Date(animEndMs + 24 * 3_600_000).toISOString()
  const ACTIVE_STATUSES = ['pending_validation', 'open', 'preparing', 'running'] as const
  const SLOT_COLUMNS = 'id, title, scheduled_at, planned_duration_min, prep_time_min, actual_duration_min, actual_prep_time_min, started_at, ended_at, prep_started_at'

  const [{ data: createdRows }, { data: participantRows }] = await Promise.all([
    db
      .from('animations')
      .select(SLOT_COLUMNS)
      .eq('creator_id', profile.id)
      .neq('id', animation_id)
      .in('status', ACTIVE_STATUSES as unknown as string[])
      .gte('scheduled_at', windowFromIso)
      .lt('scheduled_at', windowToIso),
    db
      .from('animation_participants')
      .select(`joined_at, participation_ended_at, animations!inner(${SLOT_COLUMNS}, status)`)
      .eq('user_id', profile.id)
      .in('status', ['pending', 'validated'])
      .neq('animation_id', animation_id)
      .in('animations.status' as never, ACTIVE_STATUSES as unknown as string[])
      .gte('animations.scheduled_at' as never, windowFromIso)
      .lt('animations.scheduled_at' as never, windowToIso),
  ])

  type CandidateAnim = {
    id: string
    title: string
    scheduled_at: string
    planned_duration_min: number | null
    prep_time_min: number | null
    actual_duration_min: number | null
    actual_prep_time_min: number | null
    started_at: string | null
    ended_at: string | null
    prep_started_at: string | null
  }
  const candidates: Array<{ animation: CandidateAnim; joinedAt?: string | null; participationEndedAt?: string | null }> = [
    ...((createdRows ?? []) as CandidateAnim[]).map((animation) => ({ animation })),
    ...((participantRows ?? []) as Array<{ joined_at: string | null; participation_ended_at: string | null; animations: CandidateAnim }>)
      .filter((row) => !!row.animations)
      .map((row) => ({
        animation: row.animations,
        joinedAt: row.joined_at,
        participationEndedAt: row.participation_ended_at,
      })),
  ]

  const overlap = candidates.find((candidate) => {
    const { startMs: cStart, endMs: cEnd } = candidate.joinedAt || candidate.participationEndedAt
      ? participantSlotBounds(candidate.animation, candidate.joinedAt, candidate.participationEndedAt)
      : animationSlotBounds(candidate.animation)
    return cStart < animEndMs && cEnd > animStartMs
  })

  if (overlap)
    return errorResponse('CONFLICT', `Créneau déjà occupé par "${overlap.animation.title}". Termine ta participation avant de t'inscrire ailleurs.`)

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
        joined_at: now,
        participation_ended_at: null,
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
      joined_at: now,
      participation_ended_at: null,
    })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ participant }, 201)
})
