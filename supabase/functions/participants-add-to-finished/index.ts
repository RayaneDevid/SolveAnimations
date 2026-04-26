import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  if (profile.role !== 'responsable')
    return errorResponse('FORBIDDEN', 'Réservé aux responsables')

  const body = await req.json()
  const { animationId, userId } = body

  if (!animationId || typeof animationId !== 'string')
    return errorResponse('VALIDATION_ERROR', 'animationId requis')
  if (!userId || typeof userId !== 'string')
    return errorResponse('VALIDATION_ERROR', 'userId requis')

  const db = getServiceClient()

  const { data: animation, error: animError } = await db
    .from('animations')
    .select('id, status, pole')
    .eq('id', animationId)
    .single()

  if (animError || !animation)
    return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (animation.status !== 'finished')
    return errorResponse('VALIDATION_ERROR', 'L\'animation doit être terminée')

  const now = new Date().toISOString()

  const { data: existing } = await db
    .from('animation_participants')
    .select('id, status')
    .eq('animation_id', animationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    if (existing.status === 'validated')
      return errorResponse('CONFLICT', 'Ce membre est déjà inscrit')
    await db
      .from('animation_participants')
      .update({ status: 'validated', decided_at: now, decided_by: profile.id, character_name: null })
      .eq('id', existing.id)
  } else {
    const { error: insertError } = await db
      .from('animation_participants')
      .insert({
        animation_id: animationId,
        user_id: userId,
        character_name: null,
        status: 'validated',
        applied_at: now,
        decided_at: now,
        decided_by: profile.id,
      })
    if (insertError) {
      console.error('participants-add-to-finished insert error:', insertError)
      return errorResponse('INTERNAL_ERROR', 'Erreur lors de l\'ajout')
    }
  }

  // Ensure an animation_reports row exists for this participant
  const { data: existingReport } = await db
    .from('animation_reports')
    .select('id')
    .eq('animation_id', animationId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!existingReport) {
    const pole = animation.pole === 'mj' ? 'mj' : 'animateur'
    await db.from('animation_reports').insert({
      animation_id: animationId,
      user_id: userId,
      pole,
      character_name: '—',
      comments: null,
      submitted_at: null,
    })
  }

  return jsonResponse({ success: true }, 200)
})
