import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole, requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'
import { notifyBot } from '../_shared/bot.ts'

function hasScheduleChanged(currentScheduledAt: string, nextScheduledAt: unknown): nextScheduledAt is string {
  if (typeof nextScheduledAt !== 'string') return false
  const currentTime = new Date(currentScheduledAt).getTime()
  const nextTime = new Date(nextScheduledAt).getTime()
  return !Number.isFinite(nextTime) || nextTime !== currentTime
}

function validateFutureSchedule(nextScheduledAt: string): Response | null {
  const nextTime = new Date(nextScheduledAt).getTime()
  if (!Number.isFinite(nextTime)) {
    return errorResponse('VALIDATION_ERROR', 'Date invalide')
  }
  if (nextTime <= Date.now()) {
    return errorResponse('VALIDATION_ERROR', 'La nouvelle date doit être dans le futur')
  }
  return null
}

// deno-lint-ignore no-explicit-any
async function removeParticipantsForReschedule(db: any, animationId: string, actorId: string): Promise<string[]> {
  const { data: participants } = await db
    .from('animation_participants')
    .select('user_id, user:profiles!animation_participants_user_id_fkey(discord_id)')
    .eq('animation_id', animationId)
    .in('status', ['pending', 'validated'])

  const formerDiscordIds = (participants ?? [])
    .map((p: { user?: { discord_id?: string | null } }) => p.user?.discord_id)
    .filter((discordId: string | null | undefined): discordId is string => typeof discordId === 'string' && discordId.length > 0)

  if ((participants ?? []).length > 0) {
    await db
      .from('animation_participants')
      .update({ status: 'removed', decided_at: new Date().toISOString(), decided_by: actorId })
      .eq('animation_id', animationId)
      .in('status', ['pending', 'validated'])
  }

  return formerDiscordIds
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')
  if (updates.type === 'petite') {
    return errorResponse('VALIDATION_ERROR', "Le type Petite n'existe plus. Utilise Moyenne ou Grande.")
  }

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')

  // ── Senior/responsable correcting a finished animation ───────────────────
  if (anim.status === 'finished') {
    const guard = requireRole(profile, 'senior')
    if (guard) return guard

    const allowed = ['actual_duration_min', 'actual_prep_time_min', 'village', 'server', 'type', 'scheduled_at']
    const patch: Record<string, unknown> = {}
    for (const key of allowed) {
      if (key in updates) patch[key] = updates[key]
    }

    if (Object.keys(patch).length === 0)
      return errorResponse('VALIDATION_ERROR', 'Aucun champ modifiable fourni')

    const { data: updated, error } = await db
      .from('animations')
      .update(patch)
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)

    await db.from('audit_log').insert({
      actor_id: profile.id,
      action: 'animation.correct_finished',
      target_type: 'animation',
      target_id: id,
      metadata: patch,
    })

    return jsonResponse({ animation: updated })
  }

  // ── Responsable editing the schedule of an open animation ────────────────
  const isCreator = anim.creator_id === profile.id
  const isResponsable = isResponsableRole(profile)

  if (!isCreator && isResponsable && anim.status === 'open') {
    if (!('scheduled_at' in updates))
      return errorResponse('VALIDATION_ERROR', 'Date et heure requises')

    const shouldReschedule = hasScheduleChanged(anim.scheduled_at, updates.scheduled_at)
    if (shouldReschedule) {
      const scheduleError = validateFutureSchedule(updates.scheduled_at)
      if (scheduleError) return scheduleError
    }

    const { data: updated, error } = await db
      .from('animations')
      .update({
        scheduled_at: updates.scheduled_at,
        reminder_15min_sent_at: null,
        ...(shouldReschedule ? {
          postponed_from: anim.scheduled_at,
          postpone_count: (anim.postpone_count ?? 0) + 1,
        } : {}),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)

    const formerDiscordIds = shouldReschedule
      ? await removeParticipantsForReschedule(db, id, profile.id)
      : []

    if (anim.discord_message_id) {
      await syncEmbed(db, id)
    }

    if (shouldReschedule) {
      await notifyBot('animation-postponed', {
        animationId: id,
        newScheduledAt: updates.scheduled_at,
        title: updated.title,
        formerParticipantDiscordIds: formerDiscordIds,
      })
    }

    return jsonResponse({ animation: updated })
  }

  // ── Creator editing a pending/open animation ─────────────────────────────
  if (!isCreator)
    return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut modifier')
  if (!['pending_validation', 'open'].includes(anim.status))
    return errorResponse('CONFLICT', 'Impossible de modifier cette animation dans son état actuel')

  const allowed = [
    'title', 'scheduled_at', 'planned_duration_min', 'required_participants',
    'server', 'type', 'prep_time_min', 'village', 'description', 'document_url', 'creator_character_name',
  ]
  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key]
  }
  let rescheduledAt: string | null = null
  if (anim.status === 'open' && hasScheduleChanged(anim.scheduled_at, patch.scheduled_at)) {
    rescheduledAt = patch.scheduled_at
    const scheduleError = validateFutureSchedule(rescheduledAt)
    if (scheduleError) return scheduleError
    patch.postponed_from = anim.scheduled_at
    patch.postpone_count = (anim.postpone_count ?? 0) + 1
  }
  if ('scheduled_at' in patch) patch.reminder_15min_sent_at = null

  if (Object.keys(patch).length === 0)
    return errorResponse('VALIDATION_ERROR', 'Aucun champ modifiable fourni')

  const { data: updated, error } = await db
    .from('animations')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  const formerDiscordIds = rescheduledAt
    ? await removeParticipantsForReschedule(db, id, profile.id)
    : []

  if (anim.discord_message_id) {
    await syncEmbed(db, id)
  }

  if (rescheduledAt) {
    await notifyBot('animation-postponed', {
      animationId: id,
      newScheduledAt: rescheduledAt,
      title: updated.title,
      formerParticipantDiscordIds: formerDiscordIds,
    })
  }

  return jsonResponse({ animation: updated })
})
