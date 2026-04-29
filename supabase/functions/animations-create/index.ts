import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

const SERVERS  = ['S1','S2','S3','S4','S5','SE1','SE2','SE3'] as const
const TYPES    = ['petite','moyenne','grande'] as const
const POLES    = ['animation','mj','les_deux'] as const
const VILLAGES = ['konoha','suna','oto','kiri','temple_camelias','autre','tout_le_monde'] as const

const PAST_DURATION: Record<string, number> = { petite: 15, moyenne: 30, grande: 60 }

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json()
  const {
    title, scheduledAt, plannedDurationMin, requiredParticipants,
    server, type, pole = 'animation', prepTimeMin = 0, village, description,
    requestValidation = true, pingRoles = true, spontaneous = false, missionKind = 'classique',
  } = body
  const isInstantMission = spontaneous === true || missionKind === 'spontanee_bdm'
  const resolvedScheduledAt = isInstantMission ? new Date().toISOString() : scheduledAt
  const resolvedPlannedDurationMin = isInstantMission ? 15 : plannedDurationMin
  const resolvedRequiredParticipants = isInstantMission ? 0 : requiredParticipants
  const resolvedType = isInstantMission ? 'moyenne' : type
  const resolvedPole = isInstantMission ? 'animation' : pole
  const shouldPingRoles = isInstantMission ? false : pingRoles

  // Basic validation
  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120)
    return errorResponse('VALIDATION_ERROR', 'Titre invalide (3–120 caractères)')
  if (!resolvedScheduledAt || isNaN(new Date(resolvedScheduledAt).getTime()))
    return errorResponse('VALIDATION_ERROR', 'Date invalide')
  if (!resolvedPlannedDurationMin || resolvedPlannedDurationMin < 15 || resolvedPlannedDurationMin > 720)
    return errorResponse('VALIDATION_ERROR', 'Durée invalide (15–720 min)')
  if (resolvedRequiredParticipants == null || resolvedRequiredParticipants < 0 || resolvedRequiredParticipants > 100)
    return errorResponse('VALIDATION_ERROR', 'Participants invalide (0–100)')
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
  const isPast = !isInstantMission && scheduledDate.getTime() < Date.now()

  if (isPast) {
    // Antedated animation → insert directly as finished
    const actualDurationMin = PAST_DURATION[resolvedType] ?? 30
    const startedAt = scheduledDate.toISOString()
    const endedAt = new Date(scheduledDate.getTime() + actualDurationMin * 60_000).toISOString()

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
        prep_time_min: isInstantMission ? 0 : prepTimeMin,
        village,
        description: description?.trim() || null,
        creator_id: profile.id,
        status: 'finished',
        validated_by: profile.id,
        validated_at: now,
        started_at: startedAt,
        ended_at: endedAt,
        actual_duration_min: actualDurationMin,
      })
      .select(`*, creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role)`)
      .single()

    if (error || !animation) {
      console.error('animations-create (past) error:', error)
      return errorResponse('INTERNAL_ERROR', 'Erreur lors de la création')
    }

    // Generate creator report row
    await db.from('animation_reports').insert({
      animation_id: animation.id,
      user_id: profile.id,
      pole: resolvedPole === 'mj' ? 'mj' : 'animateur',
      character_name: '—',
      comments: null,
      submitted_at: null,
    })

    return jsonResponse({ animation }, 201)
  }

  // Future animation — normal flow
  const autoValidate = isInstantMission || requestValidation === false

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
      prep_time_min: isInstantMission ? 0 : prepTimeMin,
      village,
      description: description?.trim() || null,
      creator_id: profile.id,
      status: autoValidate ? 'open' : 'pending_validation',
      ...(autoValidate ? { validated_by: profile.id, validated_at: now } : {}),
    })
    .select(`*, creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role)`)
    .single()

  if (error || !animation) {
    console.error('animations-create error:', error)
    return errorResponse('INTERNAL_ERROR', 'Erreur lors de la création')
  }

  if (autoValidate) {
    const botRes = await notifyBot<{ data: { publicMessageId: string } }>('animation-validated', {
      animationId: animation.id,
      creatorDiscordId: profile.discord_id,
      title: animation.title,
      scheduledAt: animation.scheduled_at,
      plannedDurationMin: animation.planned_duration_min,
      prepTimeMin: animation.prep_time_min,
      requiredParticipants: animation.required_participants,
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
