import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { defaultReportPole } from '../_shared/reportPole.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const body = await req.json()
  const { animationId, userIds } = body

  if (!animationId || typeof animationId !== 'string')
    return errorResponse('VALIDATION_ERROR', 'animationId requis')
  if (!Array.isArray(userIds) || userIds.length === 0 || userIds.some((u) => typeof u !== 'string'))
    return errorResponse('VALIDATION_ERROR', 'userIds requis (tableau non vide)')

  const db = getServiceClient()

  const { data: animation, error: animError } = await db
    .from('animations')
    .select('id, status, pole, bdm_mission, started_at')
    .eq('id', animationId)
    .single()

  if (animError || !animation)
    return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (animation.status !== 'finished')
    return errorResponse('VALIDATION_ERROR', 'L\'animation doit être terminée')

  const now = new Date().toISOString()
  // Retroactive add: credit them as if they joined at the animation start.
  const joinedAt = animation.started_at ?? now

  // Fetch all existing participant rows for these users in one query
  const { data: existingRows } = await db
    .from('animation_participants')
    .select('id, user_id, status')
    .eq('animation_id', animationId)
    .in('user_id', userIds)

  const existingByUser = Object.fromEntries((existingRows ?? []).map((r) => [r.user_id, r]))

  const toInsert: string[] = []
  const toUpdate: string[] = []

  for (const userId of userIds) {
    const existing = existingByUser[userId]
    if (!existing) {
      toInsert.push(userId)
    } else if (existing.status !== 'validated') {
      toUpdate.push(existing.id)
    }
    // already validated → skip silently
  }

  if (toInsert.length > 0) {
    const { error } = await db.from('animation_participants').insert(
      toInsert.map((userId) => ({
        animation_id: animationId,
        user_id: userId,
        character_name: null,
        status: 'validated',
        applied_at: now,
        decided_at: now,
        decided_by: profile.id,
        joined_at: joinedAt,
        participation_ended_at: null,
      })),
    )
    if (error) {
      console.error('participants-add-to-finished insert error:', error)
      return errorResponse('INTERNAL_ERROR', 'Erreur lors de l\'ajout')
    }
  }

  if (toUpdate.length > 0) {
    await db
      .from('animation_participants')
      .update({ status: 'validated', decided_at: now, decided_by: profile.id, character_name: null, joined_at: joinedAt, participation_ended_at: null })
      .in('id', toUpdate)
  }

  // Ensure animation_reports rows exist for all added users
  const { data: existingReports } = await db
    .from('animation_reports')
    .select('user_id')
    .eq('animation_id', animationId)
    .in('user_id', userIds)

  const reportedUserIds = new Set((existingReports ?? []).map((r) => r.user_id))
  const reportsToInsert = userIds.filter((uid) => !reportedUserIds.has(uid))

  if (reportsToInsert.length > 0) {
    const { data: reportProfiles } = await db
      .from('profiles')
      .select('id, role, available_roles')
      .in('id', reportsToInsert)
    const profileById = new Map((reportProfiles ?? []).map((p) => [p.id, p]))

    await db.from('animation_reports').insert(
      reportsToInsert.map((userId) => ({
        animation_id: animationId,
        user_id: userId,
        pole: defaultReportPole(profileById.get(userId), animation),
        character_name: '—',
        comments: null,
        submitted_at: null,
      })),
    )
  }

  return jsonResponse({ success: true, added: toInsert.length + toUpdate.length }, 200)
})
