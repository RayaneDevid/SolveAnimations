import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { hasAnyRole, requireResponsable, requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'
import { defaultReportPole } from '../_shared/reportPole.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { id } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*, creator:profiles!animations_creator_id_fkey(discord_id, username)')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.status !== 'pending_validation')
    return errorResponse('CONFLICT', 'Animation non en attente de validation')
  if (anim.bdm_mission && !hasAnyRole(profile, ['responsable_bdm', 'direction', 'gerance']))
    return errorResponse('FORBIDDEN', 'Validation réservée aux RBDM / GRP')

  const isPastMission = anim.actual_duration_min != null && new Date(anim.scheduled_at).getTime() <= Date.now()
  const validatedAt = new Date().toISOString()

  if (isPastMission) {
    const guard = requireRole(profile, 'senior')
    if (guard) return guard

    const scheduledAt = new Date(anim.scheduled_at)
    const actualDurationMin = Math.max(1, Number(anim.actual_duration_min))
    const actualPrepTimeMin = Math.max(0, Number(anim.actual_prep_time_min ?? anim.prep_time_min ?? 0))
    const updatePayload = {
      status: 'finished',
      validated_by: profile.id,
      validated_at: validatedAt,
      started_at: scheduledAt.toISOString(),
      ended_at: new Date(scheduledAt.getTime() + actualDurationMin * 60_000).toISOString(),
      actual_duration_min: actualDurationMin,
      actual_prep_time_min: actualPrepTimeMin,
      ...(actualPrepTimeMin > 0 ? {
        prep_started_at: new Date(scheduledAt.getTime() - actualPrepTimeMin * 60_000).toISOString(),
        prep_ended_at: scheduledAt.toISOString(),
      } : {}),
    }

    const { data: updated, error } = await db
      .from('animations')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)

    const { data: validatedParticipants } = await db
      .from('animation_participants')
      .select('user_id')
      .eq('animation_id', id)
      .eq('status', 'validated')

    const reportUserIds = [
      anim.creator_id,
      ...((validatedParticipants ?? [])
        .map((participant) => participant.user_id)
        .filter((userId) => userId !== anim.creator_id)),
    ]
    const { data: reportProfiles } = await db
      .from('profiles')
      .select('id, role, available_roles')
      .in('id', reportUserIds)
    const profileById = new Map((reportProfiles ?? []).map((p) => [p.id, p]))

    await db.from('animation_reports').upsert(
      reportUserIds.map((userId) => ({
        animation_id: id,
        user_id: userId,
        pole: defaultReportPole(profileById.get(userId), anim),
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
      target_id: id,
      metadata: { pastMission: true, participantCount: reportUserIds.length - 1 },
    })

    await notifyBot('animation-validated', {
      animationId: id,
      creatorDiscordId: anim.creator?.discord_id,
      title: anim.title,
      scheduledAt: anim.scheduled_at,
      plannedDurationMin: anim.planned_duration_min,
      prepTimeMin: anim.prep_time_min,
      requiredParticipants: anim.required_participants,
      registrationsLocked: anim.registrations_locked,
      server: anim.server,
      village: anim.village,
      type: anim.type,
      documentUrl: anim.document_url,
      creatorUsername: anim.creator?.username,
      adminMessageId: anim.discord_message_id ?? undefined,
      finishedPast: true,
      actualDurationMin,
      actualPrepTimeMin,
    })

    return jsonResponse({ animation: updated })
  }

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { data: updated, error } = await db
    .from('animations')
    .update({
      status: 'open',
      validated_by: profile.id,
      validated_at: validatedAt,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  // Audit
  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.validate',
    target_type: 'animation',
    target_id: id,
    metadata: {},
  })

  const botRes = await notifyBot<{ data: { publicMessageId: string } }>('animation-validated', {
    animationId: id,
    creatorDiscordId: anim.creator?.discord_id,
    title: anim.title,
    scheduledAt: anim.scheduled_at,
    plannedDurationMin: anim.planned_duration_min,
    prepTimeMin: anim.prep_time_min,
    requiredParticipants: anim.required_participants,
    registrationsLocked: anim.registrations_locked,
    server: anim.server,
    village: anim.village,
    type: anim.type,
    pole: anim.pole,
    bdmMission: anim.bdm_mission,
    bdmMissionRank: anim.bdm_mission_rank,
    bdmMissionType: anim.bdm_mission_type,
    bdmSpontaneous: anim.bdm_spontaneous,
    documentUrl: anim.document_url,
    creatorUsername: anim.creator?.username,
    adminMessageId: anim.discord_message_id ?? undefined,
  })

  // Save the public announce message ID so start/stop/finished can edit the embed
  const publicMessageId = botRes?.data?.publicMessageId
  if (publicMessageId) {
    await db.from('animations').update({ discord_message_id: publicMessageId }).eq('id', id)
  }

  return jsonResponse({ animation: updated })
})
