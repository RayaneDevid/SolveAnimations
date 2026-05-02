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
  const { user_id, weeks = 12, pole } = body

  const ANIM_ROLES = ['direction', 'gerance', 'responsable', 'senior', 'animateur']
  const MJ_ROLES   = ['responsable_mj', 'mj_senior', 'mj']

  const db = getServiceClient()

  // Compute the start of the current week (Saturday 04:00 Europe/Paris)
  const { data: weekStartRow, error: weekErr } = await db
    .rpc('week_start')
    .single()

  if (weekErr || !weekStartRow) {
    return errorResponse('INTERNAL_ERROR', 'Impossible de calculer week_start')
  }

  const weekStart = new Date(weekStartRow as string)
  // Go back `weeks` weeks to get the oldest boundary
  const oldest = new Date(weekStart.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)

  // Build week buckets (oldest first)
  const buckets: Array<{ weekStart: Date; weekEnd: Date; label: string }> = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(weekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    // Format "Sem. DD/MM"
    const d = new Date(start)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    buckets.push({ weekStart: start, weekEnd: end, label: `${day}/${month}` })
  }

  const rangeEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch all finished animations in range with creator role (for pole filter)
  const { data: rawAnims, error: allErr } = await db
    .from('animations')
    .select('id, ended_at, creator_id, creator:profiles!animations_creator_id_fkey(role)')
    .eq('status', 'finished')
    .gte('ended_at', oldest.toISOString())
    .lt('ended_at', rangeEnd)

  if (allErr) {
    return errorResponse('INTERNAL_ERROR', allErr.message)
  }

  // Apply pole filter
  const allAnims = pole
    ? (rawAnims ?? []).filter((a: { creator: { role: string } | null }) =>
        a.creator && (pole === 'anim' ? ANIM_ROLES : MJ_ROLES).includes(a.creator.role)
      )
    : (rawAnims ?? [])

  // JOIN approach — évite le .in(animation_id, animIds) avec des centaines d'UUIDs.
  // Le filtre de pôle (basé sur creator.role) est appliqué en JS après.
  const { data: participations, error: partsErr } = user_id
    ? await db
        .from('animation_participants')
        .select('animation_id, animations!inner(creator_id, creator:profiles!animations_creator_id_fkey(role))')
        .eq('user_id', user_id)
        .eq('status', 'validated')
        .eq('animations.status' as never, 'finished')
        .gte('animations.ended_at' as never, oldest.toISOString())
        .lt('animations.ended_at' as never, rangeEnd)
    : { data: null, error: null }

  if (partsErr) {
    return errorResponse('INTERNAL_ERROR', (partsErr as { message: string }).message)
  }

  type PartRow = { animation_id: string; animations: { creator_id: string; creator: { role: string } | null } | null }
  const participatedAnimationIds = new Set(
    (participations ?? [])
      .filter((p: PartRow) =>
        !pole || (p.animations?.creator?.role && (pole === 'anim' ? ANIM_ROLES : MJ_ROLES).includes(p.animations.creator.role))
      )
      .map((p: PartRow) => p.animation_id)
  )

  // Apply user filter: animations created by the user + validated participations.
  const userAnims = user_id
    ? allAnims.filter((a: { id: string; creator_id: string }) =>
        a.creator_id === user_id || participatedAnimationIds.has(a.id)
      )
    : allAnims

  // Count per bucket
  const weekData = buckets.map(({ weekStart, weekEnd, label }) => {
    const inRange = (a: { ended_at: string }) => {
      const t = new Date(a.ended_at).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    }
    const count = userAnims.filter(inRange).length
    const total = (allAnims ?? []).filter(inRange).length
    return { weekStart: weekStart.toISOString(), label, count, total }
  })

  // Fetch profiles for the user selector (filtered by pole if set)
  let profilesQuery = db
    .from('profiles')
    .select('id, username, avatar_url')
    .order('username', { ascending: true })
  if (pole) {
    profilesQuery = profilesQuery.in('role', pole === 'anim' ? ANIM_ROLES : MJ_ROLES)
  }
  const { data: profiles } = await profilesQuery

  return jsonResponse({ weeks: weekData, profiles: profiles ?? [] })
})
