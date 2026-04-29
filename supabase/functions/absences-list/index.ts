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
    const today = parisDateString(new Date())

    const { data: absences } = await db
      .from('user_absences')
      .select('user_id, profiles(username, avatar_url, role)')
      .gte('to_date', today)

    const seen = new Map<string, { username: string; avatar_url: string | null; role: string | null }>()
    for (const a of absences ?? []) {
      if (!seen.has(a.user_id)) {
        const p = a.profiles as { username: string; avatar_url: string | null; role: string | null } | null
        seen.set(a.user_id, { username: p?.username ?? 'Inconnu', avatar_url: p?.avatar_url ?? null, role: p?.role ?? null })
      }
    }
    const absentMembers = Array.from(seen.values())
    const { data: profiles } = await db.from('profiles').select('role')
    const totalStaff = profiles?.length ?? 0
    const isAnimationRole = (role: string | null) => ['direction', 'gerance', 'responsable', 'senior', 'animateur'].includes(role ?? '')
    const isMjRole = (role: string | null) => ['responsable_mj', 'mj_senior', 'mj'].includes(role ?? '')
    const absentByPole = {
      animation: absentMembers.filter((member) => isAnimationRole(member.role)),
      mj: absentMembers.filter((member) => isMjRole(member.role)),
    }
    const totalByPole = {
      animation: (profiles ?? []).filter((profile) => isAnimationRole(profile.role)).length,
      mj: (profiles ?? []).filter((profile) => isMjRole(profile.role)).length,
    }

    return jsonResponse({
      absentCount: absentMembers.length,
      totalStaff,
      absentMembers,
      absentByPole,
      totalByPole,
    })
  }

  // Only responsable can query other users' absences
  if (user_id && user_id !== profile.id && !['direction', 'gerance', 'responsable', 'responsable_mj'].includes(profile.role))
    return errorResponse('FORBIDDEN', 'Accès refusé')

  const targetId = user_id ?? profile.id

  const { data, error } = await db
    .from('user_absences')
    .select(`
      *,
      declarer:profiles!user_absences_declared_by_fkey(id, username, avatar_url)
    `)
    .eq('user_id', targetId)
    .order('from_date', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(data ?? [])
})

function parisDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}
