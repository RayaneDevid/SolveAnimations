import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { hasEffectiveRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

const SERVERS  = ['S1','S2','S3','S4','S5','SE1','SE2','SE3'] as const
const TYPES    = ['moyenne','grande'] as const
const POLES    = ['animation','mj','les_deux'] as const
const VILLAGES = ['konoha','suna','oto','kiri','temple_camelias','autre','tout_le_monde'] as const
const MISSION_KINDS = ['classique','spontanee_bdm','passee'] as const

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json()
  const {
    title, scheduledAt, plannedDurationMin, requiredParticipants,
    server, type, pole = 'animation', prepTimeMin = 0, village, description,
    registrationsLocked = false,
    pastParticipantIds = [],
    requestValidation = true, pingRoles = true, spontaneous = false, missionKind = 'classique',
  } = body
  const isInstantMission = spontaneous === true || missionKind === 'spontanee_bdm'
  const isPastMission = missionKind === 'passee'
  const resolvedScheduledAt = isInstantMission ? new Date().toISOString() : scheduledAt
  const resolvedPlannedDurationMin = isInstantMission ? 15 : plannedDurationMin
  const resolvedRequiredParticipants = isInstantMission ? 0 : requiredParticipants
  const resolvedType = isInstantMission ? 'moyenne' : type
  const resolvedPole = isInstantMission ? 'animation' : pole
  const resolvedPrepTimeMin = isInstantMission ? 0 : prepTimeMin
  const shouldPingRoles = isInstantMission ? false : pingRoles
  const shouldLockRegistrations = registrationsLocked === true
  if (pastParticipantIds !== undefined && !Array.isArray(pastParticipantIds))
    return errorResponse('VALIDATION_ERROR', 'Participants passés invalides')
  const selectedPastParticipantIds = isPastMission
    ? [...new Set((pastParticipantIds as unknown[]).filter((id): id is string => typeof id === 'string'))]
        .filter((id) => id !== profile.id)
    : []
  if (selectedPastParticipantIds.some((id) => !/^[0-9a-f-]{36}$/i.test(id)))
    return errorResponse('VALIDATION_ERROR', 'Participants passés invalides')

  // Basic validation
  if (!MISSION_KINDS.includes(missionKind))
    return errorResponse('VALIDATION_ERROR', 'Type de mission invalide')
  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120)
    return errorResponse('VALIDATION_ERROR', 'Titre invalide (3–120 caractères)')
  if (!resolvedScheduledAt || isNaN(new Date(resolvedScheduledAt).getTime()))
    return errorResponse('VALIDATION_ERROR', 'Date invalide')
  if (!resolvedPlannedDurationMin || resolvedPlannedDurationMin < 15 || resolvedPlannedDurationMin > 720)
    return errorResponse('VALIDATION_ERROR', 'Durée invalide (15–720 min)')
  if (resolvedRequiredParticipants == null || resolvedRequiredParticipants < 0 || resolvedRequiredParticipants > 100)
    return errorResponse('VALIDATION_ERROR', 'Participants invalide (0–100)')
  if (resolvedPrepTimeMin == null || resolvedPrepTimeMin < 0 || resolvedPrepTimeMin > 600)
    return errorResponse('VALIDATION_ERROR', 'Temps de préparation invalide (0–600 min)')
  if (!SERVERS.includes(server))
    return errorResponse('VALIDATION_ERROR', 'Serveur invalide')
  if (!TYPES.includes(resolvedType))
    return errorResponse('VALIDATION_ERROR', 'Type invalide')
  if (!POLES.includes(resolvedPole))
    return errorResponse('VALIDATION_ERROR', 'Pôle invalide')
  if (!VILLAGES.includes(village))
    return errorResponse('VALIDATION_ERROR', 'Village invalide')

  const db = getServiceClient()
  const now = new Date().toISOString()
  const scheduledDate = new Date(resolvedScheduledAt)
  const scheduledTime = scheduledDate.getTime()
  if (isPastMission && scheduledTime > Date.now())
    return errorResponse('VALIDATION_ERROR', 'Une mission passée ne peut pas être dans le futur')
  if (!isInstantMission && !isPastMission && scheduledTime < Date.now())
    return errorResponse('VALIDATION_ERROR', 'Une mission classique ne peut pas être antidatée')

  const canSelfValidatePastMission = isPastMission && hasEffectiveRole(profile, 'senior')
  const autoValidate = isInstantMission || (!isPastMission && requestValidation === false)
  const autoFinishPastMission = isPastMission && canSelfValidatePastMission
  const actualDurationMin = Math.max(1, Number(resolvedPlannedDurationMin))
  const actualPrepTimeMin = Math.max(0, Number(resolvedPrepTimeMin ?? 0))

  if (selectedPastParticipantIds.length > 0) {
    const { data: selectedProfiles, error: selectedProfilesError } = await db
      .from('profiles')
      .select('id')
      .eq('is_active', true)
      .in('id', selectedPastParticipantIds)

    if (selectedProfilesError) return errorResponse('INTERNAL_ERROR', selectedProfilesError.message)
    if ((selectedProfiles ?? []).length !== selectedPastParticipantIds.length)
      return errorResponse('VALIDATION_ERROR', 'Un participant sélectionné est invalide')
  }

  const { data: animation, error } = await db
    .from('animations')
    .insert({
      title: title.trim(),
      scheduled_at: resolvedScheduledAt,
      planned_duration_min: resolvedPlannedDurationMin,
      required_participants: resolvedRequiredParticipants,
      server,
      type: resolvedType,
      pole: resolvedPole,
      prep_time_min: resolvedPrepTimeMin,
      village,
      description: description?.trim() || null,
      registrations_locked: shouldLockRegistrations,
      creator_id: profile.id,
      status: autoFinishPastMission ? 'finished' : isPastMission ? 'pending_validation' : autoValidate ? 'open' : 'pending_validation',
      ...(isPastMission ? {
        actual_duration_min: actualDurationMin,
        actual_prep_time_min: actualPrepTimeMin,
      } : {}),
      ...(autoValidate || autoFinishPastMission ? { validated_by: profile.id, validated_at: now } : {}),
      ...(autoFinishPastMission ? {
        started_at: scheduledDate.toISOString(),
        ended_at: new Date(scheduledTime + actualDurationMin * 60_000).toISOString(),
        ...(actualPrepTimeMin > 0 ? {
          prep_started_at: new Date(scheduledTime - actualPrepTimeMin * 60_000).toISOString(),
          prep_ended_at: scheduledDate.toISOString(),
        } : {}),
      } : {}),
    })
    .select(`*, creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role)`)
    .single()

  if (error || !animation) {
    console.error('animations-create error:', error)
    return errorResponse('INTERNAL_ERROR', 'Erreur lors de la création')
  }

  if (selectedPastParticipantIds.length > 0) {
    const { error: participantsError } = await db.from('animation_participants').insert(
      selectedPastParticipantIds.map((userId) => ({
        animation_id: animation.id,
        user_id: userId,
        character_name: null,
        status: 'validated',
        applied_at: now,
        decided_at: now,
        decided_by: profile.id,
      })),
    )

    if (participantsError) {
      console.error('animations-create participants error:', participantsError)
      return errorResponse('INTERNAL_ERROR', 'Erreur lors de l\'ajout des participants')
    }
  }

  if (autoFinishPastMission) {
    const reportUserIds = [profile.id, ...selectedPastParticipantIds]
    await db.from('animation_reports').upsert(
      reportUserIds.map((userId) => ({
        animation_id: animation.id,
        user_id: userId,
        pole: animation.pole === 'mj' ? 'mj' : 'animateur',
        character_name: '—',
        comments: null,
        submitted_at: null,
      })),
      { onConflict: 'animation_id,user_id' },
    )

    await db.from('audit_log').insert({
      actor_id: profile.id,
      action: 'animation.validate',
      target_type: 'animation',
      target_id: animation.id,
      metadata: { pastMission: true, selfValidated: true, participantCount: selectedPastParticipantIds.length },
    })
  } else if (autoValidate) {
    const botRes = await notifyBot<{ data: { publicMessageId: string } }>('animation-validated', {
      animationId: animation.id,
      creatorDiscordId: profile.discord_id,
      title: animation.title,
      scheduledAt: animation.scheduled_at,
      plannedDurationMin: animation.planned_duration_min,
      prepTimeMin: animation.prep_time_min,
      requiredParticipants: animation.required_participants,
      registrationsLocked: animation.registrations_locked,
      server: animation.server,
      village: animation.village,
      type: animation.type,
      pole: animation.pole,
      pingRoles: shouldPingRoles,
      documentUrl: animation.document_url ?? undefined,
      creatorUsername: profile.username,
    })
    const publicMessageId = botRes?.data?.publicMessageId
    if (publicMessageId) {
      await db.from('animations').update({ discord_message_id: publicMessageId }).eq('id', animation.id)
      animation.discord_message_id = publicMessageId
    }
  } else {
    const botRes = await notifyBot<{ data: { adminMessageId: string } }>('animation-created', {
      animationId: animation.id,
      title: animation.title,
      scheduledAt: animation.scheduled_at,
      plannedDurationMin: animation.planned_duration_min,
      prepTimeMin: animation.prep_time_min,
      requiredParticipants: animation.required_participants,
      registrationsLocked: animation.registrations_locked,
      server: animation.server,
      village: animation.village,
      type: animation.type,
      pole: animation.pole,
      creatorUsername: profile.username,
      creatorDiscordId: profile.discord_id,
      ...(animation.document_url ? { documentUrl: animation.document_url } : {}),
    })
    const adminMessageId = botRes?.data?.adminMessageId
    if (adminMessageId) {
      await db.from('animations').update({ discord_message_id: adminMessageId }).eq('id', animation.id)
      animation.discord_message_id = adminMessageId
    }
  }

  return jsonResponse({ animation }, 201)
})
