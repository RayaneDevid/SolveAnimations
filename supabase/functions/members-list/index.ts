import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { requireResponsable } from '../_shared/guards.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const db = getServiceClient()

  const weekStart = computeWeekStart(new Date())
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  const today = new Date().toISOString().split('T')[0]

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('*')
    .eq('is_active', true)
    .order('username', { ascending: true })

  if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)

  const profileIds = (profiles ?? []).map((p) => p.id)

  // Weekly finished animations per creator
  const { data: weeklyAnims } = await db
    .from('animations')
    .select('creator_id, actual_duration_min')
    .eq('status', 'finished')
    .gte('ended_at', weekStart.toISOString())
    .lt('ended_at', weekEnd.toISOString())
    .in('creator_id', profileIds)

  // Total finished animations per creator (all time)
  const { data: totalAnims } = await db
    .from('animations')
    .select('creator_id, actual_duration_min')
    .eq('status', 'finished')
    .in('creator_id', profileIds)

  // Weekly validated participations
  const { data: weeklyParts } = await db
    .from('animation_participants')
    .select('user_id, animations!inner(ended_at, status)')
    .eq('status', 'validated')
    .eq('animations.status' as never, 'finished')
    .gte('animations.ended_at' as never, weekStart.toISOString())
    .lt('animations.ended_at' as never, weekEnd.toISOString())
    .in('user_id', profileIds)

  // Current absences (today falls between from_date and to_date)
  const { data: absences } = await db
    .from('user_absences')
    .select('user_id, from_date, to_date')
    .lte('from_date', today)
    .gte('to_date', today)
    .in('user_id', profileIds)

  const absentIds = new Set((absences ?? []).map((a) => a.user_id))

  // Build per-user aggregates
  const weeklyAnimMap = new Map<string, { count: number; minutes: number }>()
  for (const a of weeklyAnims ?? []) {
    const existing = weeklyAnimMap.get(a.creator_id) ?? { count: 0, minutes: 0 }
    existing.count++
    existing.minutes += a.actual_duration_min ?? 0
    weeklyAnimMap.set(a.creator_id, existing)
  }

  const globalTotalCount = (totalAnims ?? []).length
  const globalTotalMinutes = (totalAnims ?? []).reduce((sum, a) => sum + (a.actual_duration_min ?? 0), 0)

  const weeklyPartMap = new Map<string, number>()
  for (const p of weeklyParts ?? []) {
    weeklyPartMap.set(p.user_id, (weeklyPartMap.get(p.user_id) ?? 0) + 1)
  }

  const QUOTA_MAX: Record<string, number | null> = {
    direction: null,
    gerance: null,
    responsable: null,
    responsable_mj: null,
    senior: 5,
    animateur: 5,
    mj: 3,
  }

  const members = (profiles ?? []).map((p) => {
    const weekly = weeklyAnimMap.get(p.id) ?? { count: 0, minutes: 0 }
    return {
      id: p.id,
      discordId: p.discord_id,
      username: p.username,
      avatarUrl: p.avatar_url,
      role: p.role,
      lastLoginAt: p.last_login_at,
      lastRoleCheckAt: p.last_role_check_at,
      isAbsent: absentIds.has(p.id),
      weeklyStats: {
        animationsCreated: weekly.count,
        hoursAnimated: weekly.minutes,
        participationsValidated: weeklyPartMap.get(p.id) ?? 0,
        quotaMax: QUOTA_MAX[p.role] ?? null,
      },
      totalStats: {
        animationsCreated: globalTotalCount,
        hoursAnimated: globalTotalMinutes,
      },
    }
  })

  return jsonResponse(members)
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
