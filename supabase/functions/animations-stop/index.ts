import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'
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
    .select('*')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')

  const isCreator = anim.creator_id === profile.id
  if (!isCreator) {
    const guard = requireRole(profile, 'senior')
    if (guard) return guard
  }
  if (anim.status !== 'running')
    return errorResponse('CONFLICT', "L'animation doit être en cours pour être terminée")

  const endedAt = new Date().toISOString()
  const startedAt = new Date(anim.started_at!)
  const actualDurationMin = Math.max(
    1,
    Math.floor((new Date(endedAt).getTime() - startedAt.getTime()) / 60000),
  )

  const { data: updated, error } = await db
    .from('animations')
    .update({
      status: 'finished',
      ended_at: endedAt,
      actual_duration_min: actualDurationMin,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  // Generate reports for creator + validated participants
  const { data: validatedParticipants } = await db
    .from('animation_participants')
    .select('user_id, character_name')
    .eq('animation_id', id)
    .eq('status', 'validated')

  const reports = []

  const { data: creatorProfile } = await db
    .from('profiles')
    .select('role, available_roles')
    .eq('id', anim.creator_id)
    .single()

  // Creator report
  reports.push({
    animation_id: id,
    user_id: anim.creator_id,
    pole: defaultReportPole(creatorProfile, anim),
    character_name: null,
  })

  // Participant reports
  for (const p of validatedParticipants ?? []) {
    if (p.user_id === anim.creator_id) continue
    const { data: pProfile } = await db
      .from('profiles')
      .select('role, available_roles')
      .eq('id', p.user_id)
      .single()
    reports.push({
      animation_id: id,
      user_id: p.user_id,
      pole: defaultReportPole(pProfile, anim),
      character_name: null,
    })
  }

  if (reports.length > 0) {
    await db.from('animation_reports').insert(reports)
  }

  await syncEmbed(db, id)

  return jsonResponse({ animation: updated })
})
