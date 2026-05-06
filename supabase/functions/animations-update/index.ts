import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole, requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'
import { notifyBot } from '../_shared/bot.ts'

const BDM_MISSION_RANKS = ['D', 'C', 'B', 'A', 'S'] as const
const BDM_MISSION_TYPES = ['jetable', 'elaboree', 'grande_ampleur'] as const
type BdmMissionRank = (typeof BDM_MISSION_RANKS)[number]
type BdmMissionType = (typeof BDM_MISSION_TYPES)[number]

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
  const onlyRegistrationsLockUpdate = Object.keys(updates).every((key) => key === 'registrations_locked')

  if ('registrations_locked' in updates && onlyRegistrationsLockUpdate) {
    if (!isCreator && !isResponsable)
      return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut modifier les inscriptions')
    if (!['pending_validation', 'open', 'preparing', 'running'].includes(anim.status))
      return errorResponse('CONFLICT', 'Impossible de modifier les inscriptions dans cet état')
    if (typeof updates.registrations_locked !== 'boolean')
      return errorResponse('VALIDATION_ERROR', 'Verrouillage des inscriptions invalide')

    const { data: updated, error } = await db
      .from('animations')
      .update({ registrations_locked: updates.registrations_locked })
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)

    await db.from('audit_log').insert({
      actor_id: profile.id,
      action: updates.registrations_locked ? 'animation.registrations_lock' : 'animation.registrations_unlock',
      target_type: 'animation',
      target_id: id,
      metadata: { registrations_locked: updates.registrations_locked },
    })

    if (anim.discord_message_id) {
      await syncEmbed(db, id)
    }

    return jsonResponse({ animation: updated })
  }

  const onlyScheduleUpdate = Object.keys(updates).every((key) => key === 'scheduled_at')

  if (!isCreator && isResponsable && anim.status === 'open' && onlyScheduleUpdate) {
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

  // ── Creator/responsable editing a pending/open animation ─────────────────
  if (!isCreator && !isResponsable)
    return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut modifier')
  if (!['pending_validation', 'open'].includes(anim.status))
    return errorResponse('CONFLICT', 'Impossible de modifier cette animation dans son état actuel')

  const allowed = [
    'title', 'scheduled_at', 'planned_duration_min', 'required_participants',
    'server', 'type', 'pole', 'prep_time_min', 'village', 'description', 'registrations_locked',
    'document_url', 'creator_character_name',
    'bdm_mission', 'bdm_spontaneous', 'bdm_mission_rank', 'bdm_mission_type',
  ]
  const bdmFields = ['bdm_mission', 'bdm_spontaneous', 'bdm_mission_rank', 'bdm_mission_type']
  const touchesBdmFields = bdmFields.some((key) => key in updates)
  if (touchesBdmFields && !isResponsable)
    return errorResponse('FORBIDDEN', 'Seul un responsable peut modifier les paramètres BDM')

  const patch: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key]
  }

  const nextBdmMission = 'bdm_mission' in patch ? patch.bdm_mission === true : anim.bdm_mission === true
  const nextBdmSpontaneous = nextBdmMission && ('bdm_spontaneous' in patch ? patch.bdm_spontaneous === true : anim.bdm_spontaneous === true)
  const nextBdmRank = typeof patch.bdm_mission_rank === 'string' ? patch.bdm_mission_rank : anim.bdm_mission_rank ?? 'B'
  const nextBdmType = typeof patch.bdm_mission_type === 'string' ? patch.bdm_mission_type : anim.bdm_mission_type ?? 'jetable'

  if ('bdm_mission' in patch && typeof patch.bdm_mission !== 'boolean')
    return errorResponse('VALIDATION_ERROR', 'Mission BDM invalide')
  if ('bdm_spontaneous' in patch && typeof patch.bdm_spontaneous !== 'boolean')
    return errorResponse('VALIDATION_ERROR', 'Statut spontané BDM invalide')
  if (nextBdmMission && !BDM_MISSION_RANKS.includes(nextBdmRank as BdmMissionRank))
    return errorResponse('VALIDATION_ERROR', 'Rang de mission BDM invalide')
  if (nextBdmMission && !BDM_MISSION_TYPES.includes(nextBdmType as BdmMissionType))
    return errorResponse('VALIDATION_ERROR', 'Type de mission BDM invalide')

  if (nextBdmMission) {
    patch.bdm_mission = true
    patch.bdm_spontaneous = nextBdmSpontaneous
    patch.bdm_mission_rank = nextBdmRank
    patch.bdm_mission_type = nextBdmType
    patch.planned_duration_min = 15
    patch.required_participants = 0
    patch.prep_time_min = 0
    patch.type = 'moyenne'
    patch.pole = 'animation'
    if (nextBdmSpontaneous && !('scheduled_at' in patch)) {
      patch.scheduled_at = new Date().toISOString()
    }
  } else if ('bdm_mission' in patch) {
    const effectiveScheduledAt = typeof patch.scheduled_at === 'string' ? patch.scheduled_at : anim.scheduled_at
    const scheduleError = validateFutureSchedule(effectiveScheduledAt)
    if (scheduleError) return scheduleError
    patch.bdm_mission = false
    patch.bdm_spontaneous = false
    patch.bdm_mission_rank = 'B'
    patch.bdm_mission_type = 'jetable'
  }

  let rescheduledAt: string | null = null
  if (!nextBdmSpontaneous && hasScheduleChanged(anim.scheduled_at, patch.scheduled_at)) {
    rescheduledAt = patch.scheduled_at
    const scheduleError = validateFutureSchedule(rescheduledAt)
    if (scheduleError) return scheduleError
    if (anim.status === 'open') {
      patch.postponed_from = anim.scheduled_at
      patch.postpone_count = (anim.postpone_count ?? 0) + 1
    }
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
  if (!anim.bdm_mission && nextBdmMission) {
    await removeParticipantsForReschedule(db, id, profile.id)
  }

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
