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

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json()
  const {
    title, scheduledAt, plannedDurationMin, requiredParticipants,
    server, type, pole = 'animation', prepTimeMin = 0, village, description,
    requestValidation = true, pingRoles = true,
  } = body

  // Basic validation
  if (!title || typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 120)
    return errorResponse('VALIDATION_ERROR', 'Titre invalide (3–120 caractères)')
  if (!scheduledAt || new Date(scheduledAt).getTime() <= Date.now())
    return errorResponse('VALIDATION_ERROR', 'La date doit être dans le futur')
  if (!plannedDurationMin || plannedDurationMin < 15 || plannedDurationMin > 720)
    return errorResponse('VALIDATION_ERROR', 'Durée invalide (15–720 min)')
  if (requiredParticipants == null || requiredParticipants < 0 || requiredParticipants > 100)
    return errorResponse('VALIDATION_ERROR', 'Participants invalide (0–100)')
  if (!SERVERS.includes(server))
    return errorResponse('VALIDATION_ERROR', 'Serveur invalide')
  if (!TYPES.includes(type))
    return errorResponse('VALIDATION_ERROR', 'Type invalide')
  if (!POLES.includes(pole))
    return errorResponse('VALIDATION_ERROR', 'Pôle invalide')
  if (!VILLAGES.includes(village))
    return errorResponse('VALIDATION_ERROR', 'Village invalide')

  const db = getServiceClient()
  const now = new Date().toISOString()
  const autoValidate = requestValidation === false

  const { data: animation, error } = await db
    .from('animations')
    .insert({
      title: title.trim(),
      scheduled_at: scheduledAt,
      planned_duration_min: plannedDurationMin,
      required_participants: requiredParticipants,
      server,
      type,
      pole,
      prep_time_min: prepTimeMin,
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
    // Auto-validée : on poste directement dans le canal public
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
      pingRoles,
      documentUrl: animation.document_url ?? undefined,
      creatorUsername: profile.username,
    })
    const publicMessageId = botRes?.data?.publicMessageId
    if (publicMessageId) {
      await db.from('animations').update({ discord_message_id: publicMessageId }).eq('id', animation.id)
      animation.discord_message_id = publicMessageId
    }
  } else {
    // Validation requise : on poste dans le canal de validation
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
