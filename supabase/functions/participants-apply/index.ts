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

  const { animation_id } = await req.json()
  if (!animation_id) return errorResponse('VALIDATION_ERROR', 'animation_id requis')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('id, creator_id, status, scheduled_at')
    .eq('id', animation_id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (!['pending_validation', 'open', 'running'].includes(anim.status))
    return errorResponse('CONFLICT', "L'animation n'est pas ouverte aux inscriptions")
  if (anim.creator_id === profile.id)
    return errorResponse('FORBIDDEN', 'Le créateur ne peut pas se proposer sur sa propre animation')

  // Check absence covering the animation date
  const animDate = anim.scheduled_at.split('T')[0]
  const { data: absence } = await db
    .from('user_absences')
    .select('id')
    .eq('user_id', profile.id)
    .lte('from_date', animDate)
    .gte('to_date', animDate)
    .limit(1)
    .maybeSingle()

  if (absence)
    return errorResponse('CONFLICT', 'Tu as une absence déclarée pour cette date')

  // Reactivate an existing row if already present (e.g. after self-withdraw or creator-kick)
  const { data: existing } = await db
    .from('animation_participants')
    .select('id, status')
    .eq('animation_id', animation_id)
    .eq('user_id', profile.id)
    .maybeSingle()

  if (existing && ['pending', 'validated'].includes(existing.status))
    return errorResponse('CONFLICT', 'Tu es déjà inscrit à cette animation')

  const now = new Date().toISOString()

  if (existing) {
    const { data: participant, error } = await db
      .from('animation_participants')
      .update({
        status: 'validated',
        character_name: null,
        applied_at: now,
        decided_at: now,
        decided_by: profile.id,
      })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return errorResponse('INTERNAL_ERROR', error.message)
    return jsonResponse({ participant }, 200)
  }

  const { data: participant, error } = await db
    .from('animation_participants')
    .insert({
      animation_id,
      user_id: profile.id,
      character_name: null,
      status: 'validated',
      decided_at: now,
      decided_by: profile.id,
    })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ participant }, 201)
})
