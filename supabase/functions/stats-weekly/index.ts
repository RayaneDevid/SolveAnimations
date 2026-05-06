import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { getAllowedReportPoles, type ReportPole } from '../_shared/reportPole.ts'
import { computeParticipantDuration } from '../_shared/participantDuration.ts'

const QUOTA_MAX: Record<string, number | null> = {
  direction: null,
  gerance: null,
  responsable: null,
  responsable_mj: null,
  senior: 5,
  mj_senior: 3,
  animateur: 5,
  mj: 3,
  bdm: 3,
  responsable_bdm: 3,
}

function resolvePayRole(role: string, payPole: 'animation' | 'mj' | null | undefined): string {
  if (payPole === 'animation') return role === 'senior' ? 'senior' : 'animateur'
  if (payPole === 'mj') return role === 'mj_senior' ? 'mj_senior' : 'mj'
  return role
}

function reportPoleForRole(role: string): ReportPole {
  if (role === 'mj' || role === 'mj_senior' || role === 'responsable_mj') return 'mj'
  if (role === 'bdm' || role === 'responsable_bdm') return 'bdm'
  return 'animateur'
}

function quotaRoleForPole(pole: ReportPole, roles: string[]): string {
  if (pole === 'bdm') return roles.includes('responsable_bdm') ? 'responsable_bdm' : 'bdm'
  if (pole === 'mj') return roles.includes('responsable_mj') ? 'responsable_mj' : roles.includes('mj_senior') ? 'mj_senior' : 'mj'
  if (roles.includes('direction')) return 'direction'
  if (roles.includes('gerance')) return 'gerance'
  if (roles.includes('responsable')) return 'responsable'
  if (roles.includes('senior')) return 'senior'
  return 'animateur'
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json().catch(() => ({}))
  const { user_id, week_start, pole: requestedPoleRaw } = body

  if (user_id && user_id !== profile.id && !isResponsableRole(profile))
    return errorResponse('FORBIDDEN', 'Accès refusé')

  if (week_start && Number.isNaN(new Date(week_start).getTime()))
    return errorResponse('VALIDATION_ERROR', 'week_start invalide')

  const requestedPole: ReportPole | null =
    requestedPoleRaw === 'animateur' || requestedPoleRaw === 'mj' || requestedPoleRaw === 'bdm'
      ? requestedPoleRaw
      : null
  if (requestedPoleRaw && !requestedPole)
    return errorResponse('VALIDATION_ERROR', 'pole invalide')

  const targetId = user_id ?? profile.id

  const db = getServiceClient()

  let weekStart: string
  let weekEnd: string
  if (week_start) {
    const ws = new Date(week_start)
    weekStart = ws.toISOString()
    weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  } else {
    // Use PostgreSQL week_start/week_end SQL functions
    const { data: bounds } = await db
      .rpc('get_current_week_bounds' as never) as { data: { week_start: string; week_end: string } | null; error: unknown }

    // Fallback to JS calculation if RPC not available
    if (bounds) {
      weekStart = (bounds as { week_start: string }).week_start
      weekEnd = (bounds as { week_end: string }).week_end
    } else {
      const ws = computeWeekStart()
      weekStart = ws.toISOString()
      weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
    }
  }

  const { data: targetProfile } = await db
    .from('profiles')
    .select('role, pay_pole, available_roles')
    .eq('id', targetId)
    .single()

  const targetRole = targetProfile?.role ?? profile.role
  const targetPayPole = targetProfile?.pay_pole ?? null
  const targetRoles = Array.from(new Set([
    ...(targetProfile?.available_roles ?? []),
    targetRole,
  ].filter(Boolean) as string[]))
  const allowedPoles = getAllowedReportPoles({
    role: targetRole,
    available_roles: targetProfile?.available_roles ?? null,
  })

  let quotaPole: ReportPole
  let quotaMax: number | null

  if (requestedPole) {
    if (!allowedPoles.includes(requestedPole))
      return errorResponse('FORBIDDEN', 'Pôle non disponible pour ce membre')
    quotaPole = requestedPole
    quotaMax = QUOTA_MAX[quotaRoleForPole(requestedPole, targetRoles)] ?? null
  } else {
    const inferredRole = resolvePayRole(targetRole, targetPayPole)
    quotaMax = QUOTA_MAX[inferredRole] ?? null
    quotaPole = reportPoleForRole(inferredRole)
  }

  const includeNonBdm = quotaPole !== 'bdm'

  // Finished animations created by target this week
  const { data: finishedAnims } = includeNonBdm ? await db
    .from('animations')
    .select('id, actual_duration_min, prep_time_min, actual_prep_time_min')
    .eq('creator_id', targetId)
    .eq('status', 'finished')
    .eq('bdm_mission', false)
    .gte('started_at', weekStart)
    .lt('started_at', weekEnd) : { data: [] }

  const animationsCreated = finishedAnims?.length ?? 0
  const hoursFromCreated = (finishedAnims ?? []).reduce(
    (sum, a) => sum + (a.actual_duration_min ?? 0) + (a.actual_prep_time_min ?? a.prep_time_min ?? 0),
    0,
  )

  // Participations validated on finished animations this week
  const { data: participationRows } = includeNonBdm ? await db
    .from('animation_participants')
    .select('animation_id, joined_at, participation_ended_at, animations!inner(started_at, ended_at, status, actual_duration_min, prep_time_min, actual_prep_time_min)')
    .eq('user_id', targetId)
    .eq('status', 'validated')
    .eq('animations.status' as never, 'finished')
    .eq('animations.bdm_mission' as never, false)
    .gte('animations.started_at' as never, weekStart)
    .lt('animations.started_at' as never, weekEnd) : { data: [] }

  const { data: bdmReportRows } = await db
    .from('animation_reports')
    .select('user_id, pole, animation_id, animations!inner(creator_id, started_at, ended_at, status, bdm_mission, actual_duration_min, prep_time_min, actual_prep_time_min)')
    .eq('user_id', targetId)
    .eq('pole', quotaPole)
    .eq('animations.status' as never, 'finished')
    .eq('animations.bdm_mission' as never, true)
    .gte('animations.started_at' as never, weekStart)
    .lt('animations.started_at' as never, weekEnd)

  // joined_at lookup for the user's BDM participations
  const { data: bdmParticipationRowsRaw } = await db
    .from('animation_participants')
    .select('animation_id, joined_at, participation_ended_at, animations!inner(bdm_mission, status, started_at)')
    .eq('user_id', targetId)
    .eq('status', 'validated')
    .eq('animations.bdm_mission' as never, true)
    .eq('animations.status' as never, 'finished')
    .gte('animations.started_at' as never, weekStart)
    .lt('animations.started_at' as never, weekEnd)
  const bdmParticipationTimeByAnim = new Map<string, { joinedAt: string | null; endedAt: string | null }>()
  for (const row of (bdmParticipationRowsRaw ?? []) as Array<{ animation_id: string; joined_at: string | null; participation_ended_at: string | null }>) {
    bdmParticipationTimeByAnim.set(row.animation_id, {
      joinedAt: row.joined_at,
      endedAt: row.participation_ended_at,
    })
  }

  const participationsValidated = participationRows?.length ?? 0
  const hoursFromParticipations = (participationRows ?? []).reduce(
    (sum, p) => {
      const row = p as unknown as { joined_at: string | null; participation_ended_at: string | null; animations: { started_at: string | null; ended_at: string | null; actual_duration_min: number | null; prep_time_min: number | null; actual_prep_time_min: number | null } }
      const dur = computeParticipantDuration(row.joined_at, row.animations, row.participation_ended_at)
      return sum + dur.totalMinutes
    },
    0,
  )

  const bdmCreatedRows = (bdmReportRows ?? []).filter((report) => {
    const anim = (report as unknown as { animations: { creator_id: string } }).animations
    return anim?.creator_id === targetId
  })
  const bdmParticipationRows = (bdmReportRows ?? []).filter((report) => {
    const anim = (report as unknown as { animations: { creator_id: string } }).animations
    return anim?.creator_id !== targetId
  })
  const minutesFromBdmReports = (bdmReportRows ?? []).reduce((sum, report) => {
    const row = report as unknown as { animation_id: string; animations: { creator_id: string; started_at: string | null; ended_at: string | null; actual_duration_min: number | null; prep_time_min: number | null; actual_prep_time_min: number | null } }
    const isCreator = row.animations?.creator_id === targetId
    const times = isCreator ? null : bdmParticipationTimeByAnim.get(row.animation_id) ?? null
    const dur = computeParticipantDuration(times?.joinedAt ?? null, row.animations, times?.endedAt ?? null)
    return sum + dur.totalMinutes
  }, 0)

  const bdmCreated = bdmCreatedRows.length
  const bdmParticipations = bdmParticipationRows.length
  const hoursAnimated = hoursFromCreated + hoursFromParticipations + minutesFromBdmReports

  return jsonResponse({
    animationsCreated: animationsCreated + bdmCreated,
    hoursAnimated,
    participationsValidated: participationsValidated + bdmParticipations,
    quota: animationsCreated + participationsValidated + bdmCreated + bdmParticipations,
    quotaMax,
    pole: quotaPole,
    availablePoles: allowedPoles,
    weekStart,
    weekEnd,
  })
})

function computeWeekStart(): Date {
  // Mirrors SQL week_start() — Saturday 04:00 Europe/Paris
  const now = new Date()
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
  // Convert Paris local time back to UTC
  const anchorStr = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}T04:00:00`
  return new Date(new Date(anchorStr).toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}
