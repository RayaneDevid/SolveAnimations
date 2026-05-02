import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const VILLAGES = ['konoha', 'suna', 'oto', 'kiri', 'temple_camelias', 'autre', 'tout_le_monde'] as const
const ANIM_QUOTA: Record<string, number> = {
  senior: 5,
  animateur: 5,
}
const MJ_QUOTA: Record<string, number> = {
  mj_senior: 3,
  mj: 3,
}

function resolveQuotaRole(role: string, payPole: 'animation' | 'mj' | null | undefined): string | null {
  if (payPole === 'animation') return role === 'senior' ? 'senior' : 'animateur'
  if (payPole === 'mj') return role === 'mj_senior' ? 'mj_senior' : 'mj'
  if (role in ANIM_QUOTA || role in MJ_QUOTA) return role
  return null
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const db = getServiceClient()
  const body = await req.json().catch(() => ({}))
  const weekStart = body.week_start ? new Date(body.week_start) : computeWeekStart(new Date())
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Current week
  const { data: currentAnims } = await db
    .from('animations')
    .select('village')
    .eq('status', 'finished')
    .gte('ended_at', weekStart.toISOString())
    .lt('ended_at', weekEnd.toISOString())

  const currentCounts = buildCounts(currentAnims ?? [])
  const currentTotal = Object.values(currentCounts).reduce((s, v) => s + v, 0)
  const currentByVillage = buildPercentages(currentCounts, currentTotal)
  const quotaCompletion = await buildQuotaCompletion(db, weekStart, weekEnd)

  // Last 4 weeks (not including current)
  const lastFourWeeks = []
  for (let i = 1; i <= 4; i++) {
    const wStart = new Date(weekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: anims } = await db
      .from('animations')
      .select('village')
      .eq('status', 'finished')
      .gte('ended_at', wStart.toISOString())
      .lt('ended_at', wEnd.toISOString())

    const counts = buildCounts(anims ?? [])
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    lastFourWeeks.push({
      weekStart: wStart.toISOString(),
      byVillage: buildPercentages(counts, total),
      counts,
    })
  }

  return jsonResponse({
    currentWeek: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      byVillage: currentByVillage,
      counts: currentCounts,
    },
    quotaCompletion,
    lastFourWeeks,
  })
})

function buildCounts(anims: { village: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const v of VILLAGES) counts[v] = 0
  for (const a of anims) {
    if (a.village in counts) counts[a.village]++
  }
  return counts
}

function buildPercentages(counts: Record<string, number>, total: number): Record<string, number> {
  const pct: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) {
    pct[k] = total > 0 ? Math.round((v / total) * 1000) / 10 : 0
  }
  return pct
}

// deno-lint-ignore no-explicit-any
async function buildQuotaCompletion(db: any, weekStart: Date, weekEnd: Date) {
  const { data: profiles } = await db
    .from('profiles')
    .select('id, role, pay_pole')
    .eq('is_active', true)

  const quotaProfiles = (profiles ?? [])
    .map((profile: { id: string; role: string; pay_pole: 'animation' | 'mj' | null }) => ({
      ...profile,
      quotaRole: resolveQuotaRole(profile.role, profile.pay_pole),
    }))
    .filter((profile: { quotaRole: string | null }) => profile.quotaRole !== null)

  const profileIds = quotaProfiles.map((p: { id: string }) => p.id)
  if (profileIds.length === 0) {
    return {
      animation: buildQuotaSummary(0, 0),
      mj: buildQuotaSummary(0, 0),
    }
  }

  const weekStartDate = parisDateString(weekStart)
  const weekEndDate = parisDateString(weekEnd)

  const [{ data: finishedAnims }, { data: absences }] = await Promise.all([
    db
      .from('animations')
      .select('id, creator_id')
      .eq('status', 'finished')
      .gte('ended_at', weekStart.toISOString())
      .lt('ended_at', weekEnd.toISOString()),
    db
      .from('user_absences')
      .select('user_id')
      .lt('from_date', weekEndDate)
      .gt('to_date', weekStartDate),
  ])

  const absentIds = new Set((absences ?? []).map((a: { user_id: string }) => a.user_id))

  // JOIN approach — évite le double .in(animation_id, ...).in(user_id, ...) dont l'URL GET
  // peut dépasser la limite et échouer silencieusement (data = null → participations = []).
  const { data: participations } = profileIds.length > 0
    ? await db
        .from('animation_participants')
        .select('user_id, animations!inner(ended_at)')
        .eq('status', 'validated')
        .eq('animations.status' as never, 'finished')
        .gte('animations.ended_at' as never, weekStart.toISOString())
        .lt('animations.ended_at' as never, weekEnd.toISOString())
        .in('user_id', profileIds)
    : { data: [] }

  const missionCount = new Map<string, number>()
  for (const anim of finishedAnims ?? []) {
    if (!profileIds.includes(anim.creator_id)) continue
    missionCount.set(anim.creator_id, (missionCount.get(anim.creator_id) ?? 0) + 1)
  }
  for (const participation of participations ?? []) {
    missionCount.set(participation.user_id, (missionCount.get(participation.user_id) ?? 0) + 1)
  }

  let animFilled = 0
  let animMissing = 0
  let animAbsent = 0
  let mjFilled = 0
  let mjMissing = 0
  let mjAbsent = 0

  for (const profile of quotaProfiles) {
    const role = profile.quotaRole as string
    const count = missionCount.get(profile.id) ?? 0
    const isAbsent = absentIds.has(profile.id)

    if (role in ANIM_QUOTA) {
      const filled = count >= ANIM_QUOTA[role]
      if (isAbsent && !filled) { animAbsent++; continue }
      if (!isAbsent && count === 0) continue
      if (filled) animFilled++; else animMissing++
    } else if (role in MJ_QUOTA) {
      const filled = count >= MJ_QUOTA[role]
      if (isAbsent && !filled) { mjAbsent++; continue }
      if (!isAbsent && count === 0) continue
      if (filled) mjFilled++; else mjMissing++
    }
  }

  return {
    animation: buildQuotaSummary(animFilled, animMissing, animAbsent),
    mj: buildQuotaSummary(mjFilled, mjMissing, mjAbsent),
  }
}

function parisDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  const d = parts.find((p) => p.type === 'day')?.value
  return `${y}-${m}-${d}`
}

function buildQuotaSummary(filled: number, missing: number, absent: number) {
  const total = filled + missing + absent
  return {
    filled,
    missing,
    absent,
    total,
    filledPercent: total > 0 ? Math.round((filled / total) * 1000) / 10 : 0,
    missingPercent: total > 0 ? Math.round((missing / total) * 1000) / 10 : 0,
    absentPercent: total > 0 ? Math.round((absent / total) * 1000) / 10 : 0,
  }
}

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
