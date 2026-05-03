import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

function profileRoles(role: string, availableRoles: string[] | null | undefined): string[] {
  return Array.from(new Set([...(availableRoles ?? []), role].filter(Boolean)))
}

function getBdmRole(role: string, availableRoles: string[] | null | undefined): 'bdm' | 'responsable_bdm' | null {
  const roles = profileRoles(role, availableRoles)
  if (roles.includes('responsable_bdm')) return 'responsable_bdm'
  if (roles.includes('bdm')) return 'bdm'
  return null
}

function ranked<T extends { username: string }>(entries: T[], metric: (entry: T) => number): Array<T & { rank: number }> {
  return [...entries]
    .sort((a, b) => metric(b) - metric(a) || a.username.localeCompare(b.username))
    .map((entry, i) => ({ rank: i + 1, ...entry }))
}

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
  let toDate: string | null = null
  const now = new Date()

  if (period === 'week') {
    const weekStart = body.week_start ? new Date(body.week_start) : computeWeekStart(now)
    if (Number.isNaN(weekStart.getTime()))
      return errorResponse('VALIDATION_ERROR', 'week_start invalide')
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    fromDate = weekStart.toISOString()
    toDate = weekEnd.toISOString()
  } else if (period === 'month') {
    const d = new Date(now)
    d.setDate(d.getDate() - 30)
    fromDate = d.toISOString()
  }

  // Fetch all finished animations with creator info
  let animQuery = db
    .from('animations')
    .select('id, creator_id, bdm_mission, actual_duration_min, prep_time_min, actual_prep_time_min, started_at, profiles!creator_id(id, username, avatar_url, role, available_roles)')
    .eq('status', 'finished')

  if (fromDate) {
    animQuery = animQuery.gte('started_at', fromDate)
  }
  if (toDate) {
    animQuery = animQuery.lt('started_at', toDate)
  }

  const { data: animations } = await animQuery

  // Fetch all validated participations on finished animations in the period
  let partQuery = db
    .from('animation_participants')
    .select('user_id, animations!inner(creator_id, bdm_mission, started_at, status, actual_duration_min, prep_time_min, actual_prep_time_min)')
    .eq('status', 'validated')
    .eq('animations.status' as never, 'finished')

  if (fromDate) {
    partQuery = partQuery.gte('animations.started_at' as never, fromDate)
  }
  if (toDate) {
    partQuery = partQuery.lt('animations.started_at' as never, toDate)
  }

  const { data: participations } = await partQuery

  // Aggregate by user — seed with all profiles first so participations
  // are never lost for users who haven't created any animation
  const { data: allProfiles } = await db
    .from('profiles')
    .select('id, username, avatar_url, role, available_roles')

  const userMap = new Map<string, {
    userId: string
    username: string
    avatarUrl: string | null
    role: string
    primaryRole: string
    hoursAnimated: number
    animationsCreated: number
    participationsValidated: number
  }>()
  const bdmMap = new Map<string, {
    userId: string
    username: string
    avatarUrl: string | null
    role: string
    primaryRole: string
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
      primaryRole: p.role,
      hoursAnimated: 0,
      animationsCreated: 0,
      participationsValidated: 0,
    })
    const bdmRole = getBdmRole(p.role, p.available_roles)
    if (bdmRole) {
      bdmMap.set(p.id, {
        userId: p.id,
        username: p.username,
        avatarUrl: p.avatar_url,
        role: bdmRole,
        primaryRole: p.role,
        hoursAnimated: 0,
        animationsCreated: 0,
        participationsValidated: 0,
      })
    }
  }

  for (const anim of animations ?? []) {
    const duration = (anim.actual_duration_min ?? 0) + (anim.actual_prep_time_min ?? anim.prep_time_min ?? 0)
    if (anim.bdm_mission) {
      const existing = bdmMap.get(anim.creator_id)
      if (existing) {
        existing.hoursAnimated += duration
        existing.animationsCreated++
      }
      continue
    }

    const creator = (anim as unknown as { profiles: { id: string; username: string; avatar_url: string | null; role: string; available_roles: string[] | null } }).profiles
    if (!creator) continue
    const existing = userMap.get(creator.id)
    if (existing) {
      existing.hoursAnimated += duration
      existing.animationsCreated++
    }
  }

  for (const p of participations ?? []) {
    const anim = (p as unknown as { animations: { creator_id: string; bdm_mission: boolean | null; actual_duration_min: number | null; prep_time_min: number | null; actual_prep_time_min: number | null } }).animations
    if (!anim || anim.creator_id === p.user_id) continue
    const duration = (anim.actual_duration_min ?? 0) + (anim.actual_prep_time_min ?? anim.prep_time_min ?? 0)

    if (anim.bdm_mission) {
      const existing = bdmMap.get(p.user_id)
      if (existing) {
        existing.participationsValidated++
        existing.hoursAnimated += duration
      }
      continue
    }

    const existing = userMap.get(p.user_id)
    if (existing) {
      existing.participationsValidated++
      existing.hoursAnimated += duration
    }
  }

  const entries = Array.from(userMap.values())
  const bdmEntries = Array.from(bdmMap.values())

  const byHours = ranked(entries, (entry) => entry.hoursAnimated)
  const byAnimations = ranked(entries, (entry) => entry.animationsCreated)
  const byParticipations = ranked(entries, (entry) => entry.participationsValidated)
  const bdmByHours = ranked(bdmEntries, (entry) => entry.hoursAnimated)
  const bdmByAnimations = ranked(bdmEntries, (entry) => entry.animationsCreated)
  const bdmByParticipations = ranked(bdmEntries, (entry) => entry.participationsValidated)

  const result = { byHours, byAnimations, byParticipations, bdmByHours, bdmByAnimations, bdmByParticipations, period }

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
