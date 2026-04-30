import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const ACTIVE_STATUSES = ['open', 'preparing', 'running']
type Pole = 'animation' | 'mj'

function inferPole(role: string | null, payPole: Pole | null): Pole | null {
  if (payPole) return payPole
  if (['direction', 'gerance', 'responsable', 'senior', 'animateur'].includes(role ?? '')) return 'animation'
  if (['responsable_mj', 'mj_senior', 'mj'].includes(role ?? '')) return 'mj'
  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json().catch(() => ({}))
  const { day, from, to } = body as { day?: string; from?: string; to?: string }

  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    return errorResponse('VALIDATION_ERROR', 'day doit être au format YYYY-MM-DD')
  }
  if (!from || Number.isNaN(Date.parse(from)) || !to || Number.isNaN(Date.parse(to))) {
    return errorResponse('VALIDATION_ERROR', 'from/to doivent être des dates ISO valides')
  }

  const db = getServiceClient()

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, role, pay_pole')
    .eq('is_active', true)

  if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)

  const profileIds = (profiles ?? []).map((p) => p.id as string)
  if (profileIds.length === 0) {
    return jsonResponse({
      day,
      occupiedCount: 0,
      presentCount: 0,
      absentCount: 0,
      totalUsers: 0,
      activeAnimationCount: 0,
      byPole: {
        animation: { occupiedCount: 0, presentCount: 0 },
        mj: { occupiedCount: 0, presentCount: 0 },
      },
    })
  }

  // to_date is the return date: the user is no longer absent on that day.
  const { data: absences, error: absencesError } = await db
    .from('user_absences')
    .select('user_id')
    .lte('from_date', day)
    .gt('to_date', day)
    .in('user_id', profileIds)

  if (absencesError) return errorResponse('INTERNAL_ERROR', absencesError.message)

  const absentIds = new Set((absences ?? []).map((absence) => absence.user_id as string))
  const presentIds = new Set(profileIds.filter((id) => !absentIds.has(id)))
  const profilePoleMap = new Map<string, Pole>()
  for (const profile of profiles ?? []) {
    const pole = inferPole(profile.role as string | null, profile.pay_pole as Pole | null)
    if (pole) profilePoleMap.set(profile.id as string, pole)
  }

  const { data: animations, error: animationsError } = await db
    .from('animations')
    .select('id, creator_id')
    .in('status', ACTIVE_STATUSES)
    .gte('scheduled_at', from)
    .lt('scheduled_at', to)

  if (animationsError) return errorResponse('INTERNAL_ERROR', animationsError.message)

  const animationIds = (animations ?? []).map((animation) => animation.id as string)
  const occupiedIds = new Set<string>()

  for (const animation of animations ?? []) {
    const creatorId = animation.creator_id as string | null
    if (creatorId && presentIds.has(creatorId)) occupiedIds.add(creatorId)
  }

  if (animationIds.length > 0) {
    const { data: participants, error: participantsError } = await db
      .from('animation_participants')
      .select('user_id')
      .in('animation_id', animationIds)
      .eq('status', 'validated')

    if (participantsError) return errorResponse('INTERNAL_ERROR', participantsError.message)

    for (const participant of participants ?? []) {
      const userId = participant.user_id as string | null
      if (userId && presentIds.has(userId)) occupiedIds.add(userId)
    }
  }

  return jsonResponse({
    day,
    occupiedCount: occupiedIds.size,
    presentCount: presentIds.size,
    absentCount: absentIds.size,
    totalUsers: profileIds.length,
    activeAnimationCount: animationIds.length,
    byPole: {
      animation: {
        occupiedCount: Array.from(occupiedIds).filter((id) => profilePoleMap.get(id) === 'animation').length,
        presentCount: Array.from(presentIds).filter((id) => profilePoleMap.get(id) === 'animation').length,
      },
      mj: {
        occupiedCount: Array.from(occupiedIds).filter((id) => profilePoleMap.get(id) === 'mj').length,
        presentCount: Array.from(presentIds).filter((id) => profilePoleMap.get(id) === 'mj').length,
      },
    },
  })
})
