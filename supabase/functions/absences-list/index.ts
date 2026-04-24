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
  const { user_id, week_summary } = body

  const db = getServiceClient()

  if (week_summary) {
    const { data: weekStartRow } = await db.rpc('week_start').single()
    if (!weekStartRow) return errorResponse('INTERNAL_ERROR', 'Impossible de calculer week_start')
    const weekStart = new Date(weekStartRow as string)
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)
    const wStartDate = weekStart.toISOString().split('T')[0]
    const wEndDate = new Date(weekEnd.getTime() - 1).toISOString().split('T')[0]

    const { data: absences } = await db
      .from('user_absences')
      .select('user_id, profiles(username, avatar_url)')
      .lte('from_date', wEndDate)
      .gte('to_date', wStartDate)

    const seen = new Map<string, { username: string; avatar_url: string | null }>()
    for (const a of absences ?? []) {
      if (!seen.has(a.user_id)) {
        const p = a.profiles as { username: string; avatar_url: string | null } | null
        seen.set(a.user_id, { username: p?.username ?? 'Inconnu', avatar_url: p?.avatar_url ?? null })
      }
    }
    const absentMembers = Array.from(seen.values())
    const { count: totalStaff } = await db.from('profiles').select('*', { count: 'exact', head: true })
    return jsonResponse({ absentCount: absentMembers.length, totalStaff: totalStaff ?? 0, absentMembers })
  }

  // Only responsable can query other users' absences
  if (user_id && user_id !== profile.id && !['direction', 'gerance', 'responsable', 'responsable_mj'].includes(profile.role))
    return errorResponse('FORBIDDEN', 'Accès refusé')

  const targetId = user_id ?? profile.id

  const { data, error } = await db
    .from('user_absences')
    .select('*')
    .eq('user_id', targetId)
    .order('from_date', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(data ?? [])
})
