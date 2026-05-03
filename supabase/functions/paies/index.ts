import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const BASE_PAY: Record<string, number> = {
  animateur:  1_000,
  senior:     1_000,
  mj:         4_000,
  mj_senior:  5_000,
}


const ANIMATION_QUOTA_COUNT = 5
const ANIMATION_TIME_CAP = 17_000
const MJ_BEFORE_PODIUM_CAP = 17_000
const MJ_TOTAL_CAP = 20_000
const SENIOR_BASE_PAY = 2_000
const MJ_HOURLY_RATE = 800
const MJ_MOYENNE_REGISTRATION_BONUS = 200
const MJ_GRANDE_REGISTRATION_BONUS = 300
const PODIUM_BONUS = 1_000

const QUOTA_MAX: Record<string, number | null> = {
  direction:      null,
  gerance:        null,
  responsable:    null,
  responsable_mj: null,
  senior:         5,
  animateur:      5,
  mj:             3,
  mj_senior:      3,
}

type PayPole = 'animation' | 'mj'
type PayRole = 'animateur' | 'senior' | 'mj' | 'mj_senior'

function inferPayPole(role: string): PayPole | null {
  if (role === 'animateur' || role === 'senior') return 'animation'
  if (role === 'mj' || role === 'mj_senior') return 'mj'
  return null
}

function resolvePayRole(role: string, payPole: PayPole): PayRole {
  if (payPole === 'animation') return role === 'senior' ? 'senior' : 'animateur'
  return role === 'mj_senior' ? 'mj_senior' : 'mj'
}

function computeAnimationTimePay(totalMin: number, base = 0): { pay: number; capped: boolean } {
  const firstTierMin = Math.min(totalMin, 4 * 60)
  const secondTierMin = Math.min(Math.max(totalMin - 4 * 60, 0), 10 * 60)
  const thirdTierMin = Math.max(totalMin - 14 * 60, 0)
  const raw =
    base +
    firstTierMin * (1_000 / 60) +
    secondTierMin * (800 / 60) +
    thirdTierMin * (1_250 / 60)
  const rounded = Math.round(raw)
  return { pay: Math.min(rounded, ANIMATION_TIME_CAP), capped: rounded > ANIMATION_TIME_CAP }
}

function computeHourlyPay(totalMin: number, hourlyRate: number): number {
  return Math.round(totalMin * (hourlyRate / 60))
}

function topThreeIds<T extends { id: string; username: string }>(
  entries: T[],
  metric: (entry: T) => number,
): Set<string> {
  return new Set(
    [...entries]
      .filter((entry) => metric(entry) > 0)
      .sort((a, b) => metric(b) - metric(a) || a.username.localeCompare(b.username))
      .slice(0, 3)
      .map((entry) => entry.id),
  )
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const db = getServiceClient()

  const body = await req.json().catch(() => ({}))
  const weekStart = body.week_start ? new Date(body.week_start) : computeWeekStart(new Date())
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, username, avatar_url, role, pay_pole, discord_id, steam_id, is_active')
    .order('username', { ascending: true })

  if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)

  const eligibleProfiles = (profiles ?? [])
    .map((p) => {
      const payPole = (p.pay_pole ?? inferPayPole(p.role)) as PayPole | null
      return payPole ? { ...p, payPole, payRole: resolvePayRole(p.role, payPole) } : null
    })
    .filter(Boolean) as Array<{
      id: string
      username: string
      avatar_url: string | null
      role: string
      pay_pole: PayPole | null
      payPole: PayPole
      payRole: PayRole
      discord_id: string
      steam_id: string | null
      is_active: boolean
    }>

  const profileIds = eligibleProfiles.map((p) => p.id)
  const profileIdSet = new Set(profileIds)

  // Finished animations this week with type + durations
  const { data: anims } = await db
    .from('animations')
    .select('id, creator_id, type, actual_duration_min, prep_time_min, actual_prep_time_min')
    .eq('status', 'finished')
    .gte('started_at', weekStart.toISOString())
    .lt('started_at', weekEnd.toISOString())

  // Validated participations via JOIN — évite le .in(animation_id, animIds) qui génère
  // une URL GET trop longue et échoue silencieusement (data = null → ?? [] → count = 0).
  const { data: participationRows } = profileIds.length > 0
    ? await db
        .from('animation_participants')
        .select('user_id, animations!inner(creator_id, type, started_at, actual_duration_min, prep_time_min, actual_prep_time_min)')
        .eq('status', 'validated')
        .eq('animations.status' as never, 'finished')
        .gte('animations.started_at' as never, weekStart.toISOString())
        .lt('animations.started_at' as never, weekEnd.toISOString())
        .in('user_id', profileIds)
    : { data: [] }

  // Aggregate per user
  const map = new Map<string, {
    animationsCount: number
    createdAnimationsCount: number
    participationsCount: number
    animationMin: number
    prepMin: number
    moyenne: number
    grande: number
  }>()

  const getEntry = (userId: string) =>
    map.get(userId) ?? {
      animationsCount: 0,
      createdAnimationsCount: 0,
      participationsCount: 0,
      animationMin: 0,
      prepMin: 0,
      moyenne: 0,
      grande: 0,
    }

  // Created animations
  for (const a of anims ?? []) {
    if (!profileIdSet.has(a.creator_id)) continue
    const entry = getEntry(a.creator_id)
    entry.animationsCount++
    entry.createdAnimationsCount++
    entry.animationMin += a.actual_duration_min ?? 0
    entry.prepMin += a.actual_prep_time_min ?? a.prep_time_min ?? 0
    if (a.type === 'moyenne' || a.type === 'petite') entry.moyenne++
    else if (a.type === 'grande') entry.grande++
    map.set(a.creator_id, entry)
  }

  // Participated animations (validated, not the creator)
  type AnimJoin = { creator_id: string; type: string; actual_duration_min: number | null; prep_time_min: number | null; actual_prep_time_min: number | null }
  for (const p of (participationRows ?? []) as Array<{ user_id: string; animations: AnimJoin }>) {
    const anim = p.animations
    if (!anim || anim.creator_id === p.user_id) continue
    const entry = getEntry(p.user_id)
    entry.animationsCount++
    entry.participationsCount++
    entry.animationMin += anim.actual_duration_min ?? 0
    entry.prepMin += anim.actual_prep_time_min ?? anim.prep_time_min ?? 0
    if (anim.type === 'moyenne' || anim.type === 'petite') entry.moyenne++
    else if (anim.type === 'grande') entry.grande++
    map.set(p.user_id, entry)
  }

  // Formation sessions where user is a trainer this week
  const { data: trainingRows } = profileIds.length > 0
    ? await db
        .from('training_trainers')
        .select('user_id, training_sessions!inner(created_at)')
        .gte('training_sessions.created_at' as never, weekStart.toISOString())
        .lt('training_sessions.created_at' as never, weekEnd.toISOString())
        .in('user_id', profileIds)
    : { data: [] }

  const formationCountMap = new Map<string, number>()
  for (const row of (trainingRows ?? []) as Array<{ user_id: string }>) {
    formationCountMap.set(row.user_id, (formationCountMap.get(row.user_id) ?? 0) + 1)
  }

  const baseEntries = eligibleProfiles
    .filter((p) => p.is_active || map.has(p.id))
    .map((p) => {
    const s = map.get(p.id) ?? {
      animationsCount: 0, createdAnimationsCount: 0, participationsCount: 0,
      animationMin: 0, prepMin: 0,
      moyenne: 0, grande: 0,
    }
    const formationsCount = formationCountMap.get(p.id) ?? 0
    const quotaMax = QUOTA_MAX[p.payRole] ?? null
    const totalMin = s.animationMin + s.prepMin
    const isAnimationPay = p.payPole === 'animation'
    const missionCount = s.animationsCount + formationsCount
    const quotaFilled = isAnimationPay
      ? missionCount >= ANIMATION_QUOTA_COUNT
      : quotaMax === null || missionCount >= quotaMax

    const basePay = BASE_PAY[p.payRole] ?? 0
    const seniorBase = isAnimationPay && p.payRole === 'senior' && quotaFilled ? SENIOR_BASE_PAY : 0
    const animationTimePay = computeAnimationTimePay(totalMin, seniorBase)
    const mjTimePay = computeHourlyPay(totalMin, MJ_HOURLY_RATE)
    const mjRegistrationBonus =
      s.moyenne * MJ_MOYENNE_REGISTRATION_BONUS +
      s.grande * MJ_GRANDE_REGISTRATION_BONUS
    const rawMjBeforePodiumPay = basePay + mjTimePay + mjRegistrationBonus
    const mjBeforePodiumPay = Math.min(rawMjBeforePodiumPay, MJ_BEFORE_PODIUM_CAP)
    const rawMjRemuneration = quotaFilled ? mjBeforePodiumPay : 0
    return {
      id: p.id,
      username: p.username,
      avatarUrl: p.avatar_url,
      discordId: p.discord_id,
      steamId: p.steam_id,
      role: p.role,
      payPole: p.payPole,
      payRole: p.payRole,
      animationsCount: s.animationsCount,
      createdAnimationsCount: s.createdAnimationsCount,
      participationsCount: s.participationsCount,
      formationsCount,
      animationMin: s.animationMin,
      prepMin: s.prepMin,
      totalMin,
      moyenne: s.moyenne,
      grande: s.grande,
      quotaMax: isAnimationPay ? ANIMATION_QUOTA_COUNT : quotaMax,
      quotaMin: null,
      quotaFilled,
      seniorBase,
      timePay: quotaFilled ? (isAnimationPay ? animationTimePay.pay : mjTimePay) : 0,
      podiumBonus: 0,
      hoursPodiumBonus: 0,
      createdPodiumBonus: 0,
      participationPodiumBonus: 0,
      remuneration: isAnimationPay
        ? (quotaFilled ? animationTimePay.pay : 0)
        : rawMjRemuneration,
      remunerationCapped: quotaFilled && (isAnimationPay ? animationTimePay.capped : rawMjBeforePodiumPay > MJ_BEFORE_PODIUM_CAP),
      isRemoved: !p.is_active,
    }
  })

  const animationEntries = baseEntries.filter((entry) => entry.payPole === 'animation' && entry.quotaFilled)
  const animHoursPodium = topThreeIds(animationEntries, (entry) => entry.totalMin)
  const animCreatedPodium = topThreeIds(animationEntries, (entry) => entry.createdAnimationsCount)
  const animParticipationPodium = topThreeIds(animationEntries, (entry) => entry.participationsCount)

  const mjEntries = baseEntries.filter((entry) => entry.payPole === 'mj' && entry.quotaFilled)
  const mjHoursPodium = topThreeIds(mjEntries, (entry) => entry.totalMin)
  const mjCreatedPodium = topThreeIds(mjEntries, (entry) => entry.createdAnimationsCount)
  const mjParticipationPodium = topThreeIds(mjEntries, (entry) => entry.participationsCount)

  const result = baseEntries.map((entry) => {
    if (entry.payPole === 'animation') {
      const hoursPodiumBonus = animHoursPodium.has(entry.id) ? PODIUM_BONUS : 0
      const createdPodiumBonus = animCreatedPodium.has(entry.id) ? PODIUM_BONUS : 0
      const participationPodiumBonus = animParticipationPodium.has(entry.id) ? PODIUM_BONUS : 0
      const podiumBonus = hoursPodiumBonus + createdPodiumBonus + participationPodiumBonus
      return { ...entry, hoursPodiumBonus, createdPodiumBonus, participationPodiumBonus, podiumBonus, remuneration: entry.remuneration + podiumBonus }
    }
    if (entry.payPole === 'mj') {
      const hoursPodiumBonus = mjHoursPodium.has(entry.id) ? PODIUM_BONUS : 0
      const createdPodiumBonus = mjCreatedPodium.has(entry.id) ? PODIUM_BONUS : 0
      const participationPodiumBonus = mjParticipationPodium.has(entry.id) ? PODIUM_BONUS : 0
      const podiumBonus = hoursPodiumBonus + createdPodiumBonus + participationPodiumBonus
      const basePay = BASE_PAY[entry.payRole] ?? 0
      const registrationBonus =
        entry.moyenne * MJ_MOYENNE_REGISTRATION_BONUS +
        entry.grande * MJ_GRANDE_REGISTRATION_BONUS
      const rawBeforePodiumPay = basePay + entry.timePay + registrationBonus
      const beforePodiumPay = Math.min(rawBeforePodiumPay, MJ_BEFORE_PODIUM_CAP)
      const rawTotalPay = beforePodiumPay + podiumBonus
      return {
        ...entry,
        hoursPodiumBonus,
        createdPodiumBonus,
        participationPodiumBonus,
        podiumBonus,
        remuneration: entry.quotaFilled ? Math.min(rawTotalPay, MJ_TOTAL_CAP) : 0,
        remunerationCapped: entry.quotaFilled && (rawBeforePodiumPay > MJ_BEFORE_PODIUM_CAP || rawTotalPay > MJ_TOTAL_CAP),
      }
    }
    return entry
  })

  const uniqueAnimationsCount = (anims ?? []).length
  const uniqueAnimationsTotalMin = (anims ?? []).reduce(
    (s, a) => s + (a.actual_duration_min ?? 0) + (a.actual_prep_time_min ?? a.prep_time_min ?? 0),
    0,
  )

  return jsonResponse({
    entries: result,
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
    uniqueAnimationsCount,
    uniqueAnimationsTotalMin,
  })
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
