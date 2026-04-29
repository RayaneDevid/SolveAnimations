import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole, requireRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json()
  const { id, ...updates } = body
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

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

    const { data: updated, error } = await db
      .from('animations')
      .update({ scheduled_at: updates.scheduled_at, reminder_15min_sent_at: null })
      .eq('id', id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)

    if (anim.discord_message_id) {
      await syncEmbed(db, id)
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

  if (anim.discord_message_id) {
    await syncEmbed(db, id)
  }

  return jsonResponse({ animation: updated })
})
