import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const db = getServiceClient()

  const { data: former, error } = await db
    .from('profiles')
    .select('id, discord_id, username, avatar_url, role, deactivated_at, deactivation_reason, deactivated_by, ig_perms_removed, discord_perms_removed')
    .eq('is_active', false)
    .order('deactivated_at', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  // Resolve deactivated_by usernames
  const byIds = [...new Set((former ?? []).map((f) => f.deactivated_by).filter(Boolean))]
  let byMap = new Map<string, string>()

  if (byIds.length > 0) {
    const { data: byProfiles } = await db
      .from('profiles')
      .select('id, username')
      .in('id', byIds)
    for (const p of byProfiles ?? []) {
      byMap.set(p.id, p.username)
    }
  }

  // Total animations created by each former member
  const formerIds = (former ?? []).map((f) => f.id)
  const { data: totalAnims } = formerIds.length > 0
    ? await db
        .from('animations')
        .select('creator_id, actual_duration_min')
        .eq('status', 'finished')
        .in('creator_id', formerIds)
    : { data: [] }

  const totalAnimMap = new Map<string, { count: number; minutes: number }>()
  for (const a of totalAnims ?? []) {
    const existing = totalAnimMap.get(a.creator_id) ?? { count: 0, minutes: 0 }
    existing.count++
    existing.minutes += a.actual_duration_min ?? 0
    totalAnimMap.set(a.creator_id, existing)
  }

  const result = (former ?? []).map((f) => {
    const total = totalAnimMap.get(f.id) ?? { count: 0, minutes: 0 }
    return {
      id: f.id,
      discordId: f.discord_id,
      username: f.username,
      avatarUrl: f.avatar_url,
      role: f.role,
      deactivatedAt: f.deactivated_at,
      deactivationReason: f.deactivation_reason,
      deactivatedByUsername: f.deactivated_by ? (byMap.get(f.deactivated_by) ?? null) : null,
      totalAnimationsCreated: total.count,
      totalHoursAnimated: total.minutes,
      igPermsRemoved: f.ig_perms_removed ?? false,
      discordPermsRemoved: f.discord_perms_removed ?? false,
    }
  })

  return jsonResponse(result)
})
