import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const QUOTA_MAX: Record<string, number | null> = {
  direction: null,
  gerance: null,
  responsable: null,
  responsable_mj: null,
  senior: 5,
  mj_senior: 3,
  animateur: 5,
  mj: 3,
}

type ProfileRow = {
  id: string
  username: string
  avatar_url: string | null
  role: string
  pay_pole: 'animation' | 'mj' | null
  discord_username?: string | null
  steam_id?: string | null
}

function resolvePayRole(role: string, payPole: 'animation' | 'mj' | null | undefined): string {
  if (payPole === 'animation') return role === 'senior' ? 'senior' : 'animateur'
  if (payPole === 'mj') return role === 'mj_senior' ? 'mj_senior' : 'mj'
  return role
}

function profileSummary(profile: ProfileRow, quota: number, quotaMax: number) {
  return {
    id: profile.id,
    username: profile.username,
    avatar_url: profile.avatar_url,
    role: profile.role,
    discord_username: profile.discord_username ?? null,
    steam_id: profile.steam_id ?? null,
    quota,
    quotaMax,
    missing: Math.max(quotaMax - quota, 0),
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const db = getServiceClient()
  const currentStart = computeWeekStart(new Date())
  const currentEnd = new Date(currentStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  const previousStart = new Date(currentStart.getTime() - 7 * 24 * 60 * 60 * 1000)
  const previousEnd = currentStart

  const currentStartDate = parisDateString(currentStart)
  const currentEndDate = parisDateString(currentEnd)
  const previousStartDate = parisDateString(previousStart)
  const previousEndDate = parisDateString(previousEnd)

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, username, avatar_url, role, pay_pole, discord_username, steam_id')
    .eq('is_active', true)
    .order('username', { ascending: true })

  if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)

  const quotaProfiles = ((profiles ?? []) as ProfileRow[])
    .map((p) => {
      const payRole = resolvePayRole(p.role, p.pay_pole)
      return { ...p, quotaMax: QUOTA_MAX[payRole] ?? null }
    })
    .filter((p): p is ProfileRow & { quotaMax: number } => typeof p.quotaMax === 'number')

  const currentQuota = await buildMissionCounts(db, currentStart, currentEnd)
  const previousQuota = await buildMissionCounts(db, previousStart, previousEnd)
  const currentAbsences = await buildAbsenceSet(db, currentStartDate, currentEndDate)
  const previousAbsences = await buildAbsenceSet(db, previousStartDate, previousEndDate)

  const quotaMissingThisWeek = quotaProfiles
    .filter((p) => (currentQuota.get(p.id) ?? 0) < p.quotaMax)
    .map((p) => profileSummary(p, currentQuota.get(p.id) ?? 0, p.quotaMax))

  const quotaMissingTwoWeeks = quotaProfiles
    .filter((p) =>
      (currentQuota.get(p.id) ?? 0) < p.quotaMax &&
      (previousQuota.get(p.id) ?? 0) < p.quotaMax
    )
    .map((p) => profileSummary(p, currentQuota.get(p.id) ?? 0, p.quotaMax))

  const unjustifiedThisWeek = quotaProfiles
    .filter((p) => (currentQuota.get(p.id) ?? 0) < p.quotaMax && !currentAbsences.has(p.id))
    .map((p) => profileSummary(p, currentQuota.get(p.id) ?? 0, p.quotaMax))

  const unjustifiedTwoWeeks = quotaProfiles
    .filter((p) =>
      (currentQuota.get(p.id) ?? 0) < p.quotaMax &&
      (previousQuota.get(p.id) ?? 0) < p.quotaMax &&
      !currentAbsences.has(p.id) &&
      !previousAbsences.has(p.id)
    )
    .map((p) => profileSummary(p, currentQuota.get(p.id) ?? 0, p.quotaMax))

  const { data: warnings, error: warningsError } = await db
    .from('user_warnings')
    .select(`
      id, warning_date, reason, created_at,
      user:profiles!user_warnings_user_id_fkey(id, username, avatar_url, role, discord_username, steam_id),
      creator:profiles!user_warnings_created_by_fkey(id, username, avatar_url)
    `)
    .gte('warning_date', currentStartDate)
    .lt('warning_date', currentEndDate)
    .order('warning_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (warningsError) return errorResponse('INTERNAL_ERROR', warningsError.message)

  const { data: departures, error: departuresError } = await db
    .from('profiles')
    .select('id, username, avatar_url, role, discord_username, steam_id, deactivated_at, deactivation_reason, deactivated_by')
    .eq('is_active', false)
    .gte('deactivated_at', currentStart.toISOString())
    .lt('deactivated_at', currentEnd.toISOString())
    .order('deactivated_at', { ascending: false })

  if (departuresError) return errorResponse('INTERNAL_ERROR', departuresError.message)

  const deactivatedByIds = Array.from(new Set((departures ?? []).map((d) => d.deactivated_by).filter(Boolean)))
  const { data: deactivatedByProfiles, error: deactivatedByError } = deactivatedByIds.length > 0
    ? await db.from('profiles').select('id, username').in('id', deactivatedByIds)
    : { data: [], error: null }

  if (deactivatedByError) return errorResponse('INTERNAL_ERROR', deactivatedByError.message)

  const deactivatedByMap = new Map((deactivatedByProfiles ?? []).map((p) => [p.id, p.username]))

  return jsonResponse({
    week: {
      start: currentStart.toISOString(),
      end: currentEnd.toISOString(),
      startDate: currentStartDate,
      endDate: currentEndDate,
    },
    previousWeek: {
      start: previousStart.toISOString(),
      end: previousEnd.toISOString(),
      startDate: previousStartDate,
      endDate: previousEndDate,
    },
    warnings: warnings ?? [],
    departures: (departures ?? []).map((departure) => ({
      ...departure,
      deactivated_by_username: departure.deactivated_by
        ? deactivatedByMap.get(departure.deactivated_by) ?? null
        : null,
    })),
    unjustifiedThisWeek,
    unjustifiedTwoWeeks,
    quotaMissingThisWeek,
    quotaMissingTwoWeeks,
  })
})

// deno-lint-ignore no-explicit-any
async function buildMissionCounts(db: any, start: Date, end: Date): Promise<Map<string, number>> {
  const counts = new Map<string, number>()

  const { data: animations } = await db
    .from('animations')
    .select('id, creator_id')
    .eq('status', 'finished')
    .gte('ended_at', start.toISOString())
    .lt('ended_at', end.toISOString())

  const animationIds = (animations ?? []).map((animation: { id: string }) => animation.id)

  for (const animation of animations ?? []) {
    counts.set(animation.creator_id, (counts.get(animation.creator_id) ?? 0) + 1)
  }

  if (animationIds.length > 0) {
    const { data: participations } = await db
      .from('animation_participants')
      .select('user_id')
      .eq('status', 'validated')
      .in('animation_id', animationIds)

    for (const participation of participations ?? []) {
      counts.set(participation.user_id, (counts.get(participation.user_id) ?? 0) + 1)
    }
  }

  return counts
}

// deno-lint-ignore no-explicit-any
async function buildAbsenceSet(db: any, startDate: string, endDate: string): Promise<Set<string>> {
  const { data: absences } = await db
    .from('user_absences')
    .select('user_id')
    .lt('from_date', endDate)
    .gt('to_date', startDate)

  return new Set((absences ?? []).map((absence: { user_id: string }) => absence.user_id))
}

function computeWeekStart(now: Date): Date {
  const parisStr = now.toLocaleString('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
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

function parisDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}
