import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

type ProfileRole = { role?: string | null }
type AnimationRow = {
  id: string
  title: string
  creator_id: string
  discord_message_id?: string | null
  pole?: string | null
  creator?: ProfileRole | null
}
type TimeCorrectionRequest = {
  id: string
  animation_id: string
  requested_started_at: string
  requested_actual_duration_min: number
  requested_actual_prep_time_min: number | null
  animation: AnimationRow | null
}

function reportPole(role: string | null | undefined, animationPole?: string | null): 'mj' | 'animateur' {
  if (animationPole === 'mj') return 'mj'
  if (['mj', 'mj_senior', 'responsable_mj'].includes(role ?? '')) return 'mj'
  return 'animateur'
}

// deno-lint-ignore no-explicit-any
async function ensureReports(db: any, animation: AnimationRow) {
  const userEntries = new Map<string, 'mj' | 'animateur'>()
  userEntries.set(animation.creator_id, reportPole(animation.creator?.role, animation.pole))

  const { data: participants } = await db
    .from('animation_participants')
    .select('user_id, user:profiles!animation_participants_user_id_fkey(role)')
    .eq('animation_id', animation.id)
    .eq('status', 'validated')

  for (const participant of participants ?? []) {
    const userId = participant.user_id as string | null
    if (!userId || userId === animation.creator_id) continue
    const role = (participant.user as ProfileRole | null)?.role
    userEntries.set(userId, reportPole(role))
  }

  const userIds = [...userEntries.keys()]
  if (userIds.length === 0) return

  const { data: existingReports } = await db
    .from('animation_reports')
    .select('user_id')
    .eq('animation_id', animation.id)
    .in('user_id', userIds)

  const existingUserIds = new Set((existingReports ?? []).map((report: { user_id: string }) => report.user_id))
  const missingReports = userIds
    .filter((userId) => !existingUserIds.has(userId))
    .map((userId) => ({
      animation_id: animation.id,
      user_id: userId,
      pole: userEntries.get(userId) ?? 'animateur',
      character_name: null,
      comments: null,
      submitted_at: null,
    }))

  if (missingReports.length > 0) {
    await db.from('animation_reports').insert(missingReports)
  }
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { request_id } = await req.json().catch(() => ({}))
  if (!request_id) return errorResponse('VALIDATION_ERROR', 'request_id requis')

  const db = getServiceClient()

  const { data: request } = await db
    .from('animation_time_correction_requests')
    .select(`
      *,
      animation:animations(
        id, title, creator_id, discord_message_id, pole,
        creator:profiles!animations_creator_id_fkey(role)
      )
    `)
    .eq('id', request_id)
    .eq('status', 'pending')
    .single()

  if (!request) return errorResponse('NOT_FOUND', 'Demande introuvable ou déjà traitée')

  const correction = request as TimeCorrectionRequest
  const animation = correction.animation
  if (!animation) return errorResponse('NOT_FOUND', 'Animation introuvable')

  const startedAt = new Date(correction.requested_started_at)
  if (Number.isNaN(startedAt.getTime())) {
    return errorResponse('VALIDATION_ERROR', 'Date de début invalide')
  }

  const actualDurationMin = Math.max(1, Number(correction.requested_actual_duration_min))
  const actualPrepTimeMin = Math.max(0, Number(correction.requested_actual_prep_time_min ?? 0))
  const endedAt = new Date(startedAt.getTime() + actualDurationMin * 60_000)
  const updatePayload = {
    status: 'finished',
    scheduled_at: startedAt.toISOString(),
    started_at: startedAt.toISOString(),
    ended_at: endedAt.toISOString(),
    actual_duration_min: actualDurationMin,
    actual_prep_time_min: actualPrepTimeMin,
    prep_started_at: actualPrepTimeMin > 0
      ? new Date(startedAt.getTime() - actualPrepTimeMin * 60_000).toISOString()
      : null,
    prep_ended_at: actualPrepTimeMin > 0 ? startedAt.toISOString() : null,
  }

  const { data: updated, error } = await db
    .from('animations')
    .update(updatePayload)
    .eq('id', correction.animation_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await ensureReports(db, animation)

  await db
    .from('animation_time_correction_requests')
    .update({ status: 'approved', decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', correction.id)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.approve_time_correction',
    target_type: 'animation',
    target_id: correction.animation_id,
    metadata: { request_id, ...updatePayload },
  })

  if (animation.discord_message_id) {
    await syncEmbed(db, correction.animation_id)
  }

  return jsonResponse({ animation: updated })
})
