import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

function rolePool(profile: { role: string; available_roles?: string[] | null }): string[] {
  return Array.from(new Set([...(profile.available_roles ?? []), profile.role]))
}

function isInAudience(profile: { role: string; available_roles?: string[] | null; pay_pole?: 'animation' | 'mj' | null }, audience: string): boolean {
  const roles = rolePool(profile)
  if (audience === 'pole_animation') {
    return profile.pay_pole === 'animation' || roles.some((role) => ['responsable', 'senior', 'animateur'].includes(role))
  }
  if (audience === 'pole_mj') {
    return profile.pay_pole === 'mj' || roles.some((role) => ['responsable_mj', 'mj_senior', 'mj'].includes(role))
  }
  if (audience === 'pole_bdm') {
    return roles.some((role) => ['responsable_bdm', 'bdm'].includes(role))
  }
  return false
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const db = getServiceClient()

  const { data: targetedRows, error: targetedError } = await db
    .from('broadcast_recipients')
    .select('broadcast_id')
    .eq('user_id', profile.id)

  if (targetedError) return errorResponse('INTERNAL_ERROR', targetedError.message)

  const targetedIds = new Set((targetedRows ?? []).map((row) => row.broadcast_id))

  const { data: broadcasts, error } = await db
    .from('broadcasts')
    .select(`
      id, title, message, audience, created_by, created_at, archived_at,
      creator:profiles!broadcasts_created_by_fkey(id, username, avatar_url)
    `)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  const visible = (broadcasts ?? [])
    .filter((broadcast) =>
      broadcast.audience === 'all' ||
      targetedIds.has(broadcast.id) ||
      isInAudience(profile, broadcast.audience) ||
      broadcast.created_by === profile.id
    )

  return jsonResponse({ broadcasts: visible })
})
