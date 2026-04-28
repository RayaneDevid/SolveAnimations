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

  const body = await req.json().catch(() => ({}))
  const period: 'week' | 'month' | 'all' = body.period ?? 'week'

  if (!['week', 'month', 'all'].includes(period))
    return errorResponse('VALIDATION_ERROR', 'period invalide')

  const db = getServiceClient()

  let fromDate: string | null = null
  const now = new Date()

  if (period === 'week') {
    fromDate = computeWeekStart(now).toISOString()
  } else if (period === 'month') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    fromDate = d.toISOString()
  }

  // Fetch all finished animations with creator info
  let animQuery = db
    .from('animations')
    .select('id, creator_id, actual_duration_min, prep_time_min, actual_prep_time_min, ended_at, profiles!creator_id(id, username, avatar_url, role)')
    .eq('status', 'finished')

  if (fromDate) {
    animQuery = animQuery.gte('ended_at', fromDate)
  }

  const { data: animations } = await animQuery

  // Fetch all validated participations on finished animations in the period
  let partQuery = db
    .from('animation_participants')
    .select('user_id, animations!inner(ended_at, status, actual_duration_min, prep_time_min, actual_prep_time_min)')
    .eq('status', 'validated')
    .eq('animations.status' as never, 'finished')

  if (fromDate) {
    partQuery = partQuery.gte('animations.ended_at' as never, fromDate)
  }

  const { data: participations } = await partQuery

  // Aggregate by user — seed with all profiles first so participations
  // are never lost for users who haven't created any animation
  const { data: allProfiles } = await db
    .from('profiles')
    .select('id, username, avatar_url, role')

  const userMap = new Map<string, {
    userId: string
    username: string
    avatarUrl: string | null
    role: string
    hoursAnimated: number
    animationsCreated: number
    participationsValidated: number
  }>()

  for (const p of allProfiles ?? []) {
    userMap.set(p.id, {
      userId: p.id,
      username: p.username,
      avatarUrl: p.avatar_url,
      role: p.role,
      hoursAnimated: 0,
      animationsCreated: 0,
      participationsValidated: 0,
    })
  }

  for (const anim of animations ?? []) {
    const creator = (anim as unknown as { profiles: { id: string; username: string; avatar_url: string | null; role: string } }).profiles
    if (!creator) continue
    const existing = userMap.get(creator.id)
    if (existing) {
      existing.hoursAnimated += (anim.actual_duration_min ?? 0) + (anim.actual_prep_time_min ?? anim.prep_time_min ?? 0)
      existing.animationsCreated++
    }
  }

  for (const p of participations ?? []) {
    const existing = userMap.get(p.user_id)
    if (existing) {
      existing.participationsValidated++
      const anim = (p as unknown as { animations: { actual_duration_min: number | null; prep_time_min: number | null; actual_prep_time_min: number | null } }).animations
      existing.hoursAnimated += (anim?.actual_duration_min ?? 0) + (anim?.actual_prep_time_min ?? anim?.prep_time_min ?? 0)
    }
  }

  const entries = Array.from(userMap.values())

  const byHours = [...entries].sort((a, b) => b.hoursAnimated - a.hoursAnimated).map((e, i) => ({ rank: i + 1, ...e }))
  const byAnimations = [...entries].sort((a, b) => b.animationsCreated - a.animationsCreated).map((e, i) => ({ rank: i + 1, ...e }))
  const byParticipations = [...entries].sort((a, b) => b.participationsValidated - a.participationsValidated).map((e, i) => ({ rank: i + 1, ...e }))

  const result = { byHours, byAnimations, byParticipations, period }

  return jsonResponse(result)
})

function computeWeekStart(now: Date): Date {
  const parisStr = now.toLocaleString('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
  const [date, time] = parisStr.split(', ')
  const [y, m, d] = date.split('-').map(Number)
  const h = parseInt(time.split(':')[0])
  const localDate = new Date(y, m - 1, d, h, 0, 0)
  const dow = localDate.getDay()
  const daysSinceSat = (dow + 1) % 7
  const anchor = new Date(y, m - 1, d - daysSinceSat, 4, 0, 0)
  if (anchor > localDate) anchor.setDate(anchor.getDate() - 7)
  const anchorStr = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}T04:00:00`
  return new Date(new Date(anchorStr).toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}
