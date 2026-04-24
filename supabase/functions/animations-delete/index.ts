import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const DELETABLE_BY_RESPONSABLE = ['pending_validation', 'open', 'preparing', 'running', 'cancelled', 'rejected', 'postponed', 'finished']
const DELETABLE_BY_CREATOR = ['cancelled', 'rejected']

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
    .select('id, creator_id, status, title')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')

  const isCreator = anim.creator_id === profile.id
  const isResponsable = profile.role === 'responsable' || profile.role === 'responsable_mj'

  if (isResponsable) {
    if (!DELETABLE_BY_RESPONSABLE.includes(anim.status))
      return errorResponse('CONFLICT', 'Impossible de supprimer une animation en cours ou terminée')
  } else if (isCreator) {
    if (!DELETABLE_BY_CREATOR.includes(anim.status))
      return errorResponse('CONFLICT', 'Tu ne peux supprimer que tes animations annulées ou refusées')
  } else {
    return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut supprimer cette animation')
  }

  const { error } = await db
    .from('animations')
    .delete()
    .eq('id', id)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.delete',
    target_type: 'animation',
    target_id: id,
    metadata: { title: anim.title, status: anim.status },
  })

  return jsonResponse({ success: true })
})
