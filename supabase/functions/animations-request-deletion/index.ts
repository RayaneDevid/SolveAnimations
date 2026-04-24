import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

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
    .select('id, title, status, creator_id')
    .eq('id', animation_id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.creator_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Seul le créateur peut demander la suppression')
  if (anim.status === 'running')
    return errorResponse('CONFLICT', 'Impossible de demander la suppression d\'une animation en cours')

  // Check no pending request already
  const { data: existing } = await db
    .from('deletion_requests')
    .select('id')
    .eq('animation_id', animation_id)
    .eq('status', 'pending')
    .maybeSingle()

  if (existing)
    return errorResponse('CONFLICT', 'Une demande de suppression est déjà en cours pour cette animation')

  const { data: request, error } = await db
    .from('deletion_requests')
    .insert({ animation_id, requested_by: profile.id })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.request_deletion',
    target_type: 'animation',
    target_id: animation_id,
    metadata: { title: anim.title, status: anim.status },
  })

  await notifyBot('animation-deletion-requested', {
    requestId: request.id,
    animationId: anim.id,
    animationTitle: anim.title,
    animationStatus: anim.status,
    requestedByUsername: profile.username,
    requestedByDiscordId: profile.discord_id,
  })

  return jsonResponse({ request })
})
