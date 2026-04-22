import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const QUOTA_MAX: Record<string, number | null> = {
  responsable: null,
  responsable_mj: null,
  senior: 5,
  animateur: 5,
  mj: 3,
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json().catch(() => ({}))
  const { user_id } = body

  if (user_id && user_id !== profile.id && profile.role !== 'responsable' && profile.role !== 'responsable_mj')
    return errorResponse('FORBIDDEN', 'Accès refusé')

  const targetId = user_id ?? profile.id

  const db = getServiceClient()

  // Use PostgreSQL week_start/week_end SQL functions
  const { data: bounds, error: boundsError } = await db
    .rpc('get_current_week_bounds' as never) as { data: { week_start: string; week_end: string } | null; error: unknown }

  // Fallback to JS calculation if RPC not available
  let weekStart: string
  let weekEnd: string
  if (bounds) {
    weekStart = (bounds as { week_start: string }).week_start
    weekEnd = (bounds as { week_end: string }).week_end
  } else {
    const ws = computeWeekStart()
    weekStart = ws.toISOString()
    weekEnd = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()
  }

  // Finished animations created by target this week
  const { data: finishedAnims } = await db
    .from('animations')
    .select('id, actual_duration_min')
    .eq('creator_id', targetId)
    .eq('status', 'finished')
    .gte('ended_at', weekStart)
    .lt('ended_at', weekEnd)

  const animationsCreated = finishedAnims?.length ?? 0
  const hoursFromCreated = (finishedAnims ?? []).reduce(
    (sum, a) => sum + (a.actual_duration_min ?? 0),
    0,
  )

  // Participations validated on finished animations this week
  const { data: participationRows } = await db
    .from('animation_participants')
    .select('animation_id, animations!inner(ended_at, status, actual_duration_min)')
    .eq('user_id', targetId)
    .eq('status', 'validated')
    .eq('animations.status' as never, 'finished')
    .gte('animations.ended_at' as never, weekStart)
    .lt('animations.ended_at' as never, weekEnd)

  const participationsValidated = participationRows?.length ?? 0
  const hoursFromParticipations = (participationRows ?? []).reduce(
    (sum, p) => sum + ((p as unknown as { animations: { actual_duration_min: number | null } }).animations?.actual_duration_min ?? 0),
    0,
  )

  const { data: targetProfile } = await db
    .from('profiles')
    .select('role')
    .eq('id', targetId)
    .single()

  const role = targetProfile?.role ?? profile.role
  const quotaMax = QUOTA_MAX[role] ?? null

  const hoursAnimated = hoursFromCreated + hoursFromParticipations

  return jsonResponse({
    animationsCreated,
    hoursAnimated,
    participationsValidated,
    quota: animationsCreated + participationsValidated,
    quotaMax,
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
