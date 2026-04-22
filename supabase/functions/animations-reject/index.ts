import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { id, reason } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')
  if (!reason || reason.trim().length < 5)
    return errorResponse('VALIDATION_ERROR', 'Motif requis (min 5 caractères)')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*, creator:profiles!animations_creator_id_fkey(discord_id)')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.status !== 'pending_validation')
    return errorResponse('CONFLICT', 'Animation non en attente de validation')

  const { data: updated, error } = await db
    .from('animations')
    .update({
      status: 'rejected',
      rejected_by: profile.id,
      rejected_at: new Date().toISOString(),
      rejection_reason: reason.trim(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.reject',
    target_type: 'animation',
    target_id: id,
    metadata: { reason: reason.trim() },
  })

  await notifyBot('animation-rejected', {
    animationId: id,
    creatorDiscordId: anim.creator?.discord_id,
    reason: reason.trim(),
  })

  return jsonResponse({ animation: updated })
})
