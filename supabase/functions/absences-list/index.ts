import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole } from '../_shared/guards.ts'
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

    const { data: absences, error: absencesError } = await db
      .from('user_absences')
      .select('user_id, from_date, to_date')
      .gt('to_date', today)
      .order('from_date', { ascending: true })

    if (absencesError) return errorResponse('INTERNAL_ERROR', absencesError.message)

    const userIds = Array.from(new Set((absences ?? []).map((a) => a.user_id)))
    const { data: absenceProfiles, error: profilesError } = userIds.length > 0
      ? await db
        .from('profiles')
        .select('id, username, avatar_url, role')
        .in('id', userIds)
      : { data: [], error: null }

    if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)

    const profileMap = new Map((absenceProfiles ?? []).map((p) => [p.id, p]))
    const seen = new Map<string, { username: string; avatar_url: string | null; role: string | null; from_date: string; to_date: string }>()
    for (const a of absences ?? []) {
      if (!seen.has(a.user_id)) {
        const p = profileMap.get(a.user_id)
        seen.set(a.user_id, {
          username: p?.username ?? 'Inconnu',
          avatar_url: p?.avatar_url ?? null,
          role: p?.role ?? null,
          from_date: a.from_date,
          to_date: a.to_date,
        })
      }
    }
    const absentMembers = Array.from(seen.values())
    const { data: profiles } = await db.from('profiles').select('role').eq('is_active', true)
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
  if (user_id && user_id !== profile.id && !isResponsableRole(profile))
    return errorResponse('FORBIDDEN', 'Accès refusé')

  const targetId = user_id ?? profile.id

  const { data, error } = await db
    .from('user_absences')
    .select('*')
    .eq('user_id', targetId)
    .order('from_date', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  const declarerIds = Array.from(new Set((data ?? []).map((absence) => absence.declared_by).filter(Boolean)))
  const { data: declarers, error: declarersError } = declarerIds.length > 0
    ? await db
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', declarerIds)
    : { data: [], error: null }

  if (declarersError) return errorResponse('INTERNAL_ERROR', declarersError.message)

  const declarerMap = new Map((declarers ?? []).map((declarer) => [declarer.id, declarer]))
  const shaped = (data ?? []).map((absence) => ({
    ...absence,
    declarer: absence.declared_by ? declarerMap.get(absence.declared_by) ?? null : null,
  }))

  return jsonResponse(shaped)
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
