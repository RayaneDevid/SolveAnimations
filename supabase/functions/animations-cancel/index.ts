import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

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
  const isResponsable = profile.role === 'responsable' || profile.role === 'responsable_mj'

  if (!isCreator && !isResponsable)
    return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut annuler')

  const cancelableStatuses = isResponsable
    ? ['pending_validation', 'open', 'preparing', 'running']
    : ['pending_validation', 'open', 'preparing']
  if (!cancelableStatuses.includes(anim.status))
    return errorResponse('CONFLICT', 'Impossible d\'annuler une animation terminée')

  const hadPublicEmbed = !['pending_validation'].includes(anim.status)

  const { data: updated, error } = await db
    .from('animations')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.cancel',
    target_type: 'animation',
    target_id: id,
    metadata: {},
  })

  if (hadPublicEmbed) {
    await syncEmbed(db, id)
  }

  return jsonResponse({ animation: updated })
})
