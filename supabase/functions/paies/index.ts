import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const BASE_PAY = 1_000

const REMUNERATION: Record<string, number> = {
  petite:  200,
  moyenne: 350,
  grande:  500,
}
const REMUNERATION_CAP = 10_000

const QUOTA_MAX: Record<string, number | null> = {
  responsable:    null,
  responsable_mj: null,
  senior:         5,
  animateur:      5,
  mj:             3,
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  if (profile.role !== 'responsable')
    return errorResponse('FORBIDDEN', 'Accès réservé aux responsables')

  const db = getServiceClient()

  const body = await req.json().catch(() => ({}))
  const weekStart = body.week_start ? new Date(body.week_start) : computeWeekStart(new Date())
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  const { data: profiles, error: profilesError } = await db
    .from('profiles')
    .select('id, username, avatar_url, role')
    .order('username', { ascending: true })

  if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)

  const profileIds = (profiles ?? []).map((p) => p.id)

  // Finished animations this week with type + durations
  const { data: anims } = await db
    .from('animations')
    .select('id, creator_id, type, actual_duration_min, prep_time_min, actual_prep_time_min')
    .eq('status', 'finished')
    .gte('ended_at', weekStart.toISOString())
    .lt('ended_at', weekEnd.toISOString())

  // Validated participations on those animations
  const animIds = (anims ?? []).map((a) => a.id)
  const { data: participations } = animIds.length > 0
    ? await db
        .from('animation_participants')
        .select('user_id, animation_id')
        .eq('status', 'validated')
        .in('animation_id', animIds)
        .in('user_id', profileIds)
    : { data: [] }

  // Build a lookup: animId → animation
  const animById = new Map((anims ?? []).map((a) => [a.id, a]))

  // Aggregate per user
  const map = new Map<string, {
    animationsCount: number
    animationMin: number
    prepMin: number
    petite: number
    moyenne: number
    grande: number
  }>()

  const getEntry = (userId: string) =>
    map.get(userId) ?? { animationsCount: 0, animationMin: 0, prepMin: 0, petite: 0, moyenne: 0, grande: 0 }

  // Created animations
  for (const a of anims ?? []) {
    if (!profileIds.includes(a.creator_id)) continue
    const entry = getEntry(a.creator_id)
    entry.animationsCount++
    entry.animationMin += a.actual_duration_min ?? 0
    entry.prepMin += a.actual_prep_time_min ?? a.prep_time_min ?? 0
    if (a.type === 'petite') entry.petite++
    else if (a.type === 'moyenne') entry.moyenne++
    else if (a.type === 'grande') entry.grande++
    map.set(a.creator_id, entry)
  }

  // Participated animations (validated, not the creator)
  for (const p of participations ?? []) {
    const anim = animById.get(p.animation_id)
    if (!anim || anim.creator_id === p.user_id) continue
    const entry = getEntry(p.user_id)
    entry.animationsCount++
    entry.animationMin += anim.actual_duration_min ?? 0
    entry.prepMin += anim.actual_prep_time_min ?? anim.prep_time_min ?? 0
    if (anim.type === 'petite') entry.petite++
    else if (anim.type === 'moyenne') entry.moyenne++
    else if (anim.type === 'grande') entry.grande++
    map.set(p.user_id, entry)
  }

  const result = (profiles ?? []).map((p) => {
    const s = map.get(p.id) ?? {
      animationsCount: 0, animationMin: 0, prepMin: 0,
      petite: 0, moyenne: 0, grande: 0,
    }
    const quotaMax = QUOTA_MAX[p.role] ?? null
    const quotaFilled = quotaMax === null || s.animationsCount >= quotaMax

    const animPay =
      s.petite  * REMUNERATION.petite +
      s.moyenne * REMUNERATION.moyenne +
      s.grande  * REMUNERATION.grande
    const rawRemuneration = (quotaFilled ? BASE_PAY : 0) + animPay
    return {
      id: p.id,
      username: p.username,
      avatarUrl: p.avatar_url,
      role: p.role,
      animationsCount: s.animationsCount,
      animationMin: s.animationMin,
      prepMin: s.prepMin,
      totalMin: s.animationMin + s.prepMin,
      petite: s.petite,
      moyenne: s.moyenne,
      grande: s.grande,
      quotaMax,
      quotaFilled,
      remuneration: Math.min(rawRemuneration, REMUNERATION_CAP),
      remunerationCapped: rawRemuneration > REMUNERATION_CAP,
    }
  })

  const uniqueAnimationsCount = (anims ?? []).length
  const uniqueAnimationsTotalMin = (anims ?? []).reduce((s, a) => s + (a.actual_duration_min ?? 0), 0)

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
