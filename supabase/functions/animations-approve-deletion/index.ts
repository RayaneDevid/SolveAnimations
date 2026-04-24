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

  const isResponsable = profile.role === 'responsable' || profile.role === 'responsable_mj'
  if (!isResponsable)
    return errorResponse('FORBIDDEN', 'Seul un responsable peut approuver la suppression')

  const { request_id } = await req.json()
  if (!request_id) return errorResponse('VALIDATION_ERROR', 'request_id requis')

  const db = getServiceClient()

  const { data: request } = await db
    .from('deletion_requests')
    .select('*, animation:animations(id, title, status)')
    .eq('id', request_id)
    .eq('status', 'pending')
    .single()

  if (!request) return errorResponse('NOT_FOUND', 'Demande introuvable ou déjà traitée')

  // Mark as approved
  await db
    .from('deletion_requests')
    .update({ status: 'approved', decided_by: profile.id, decided_at: new Date().toISOString() })
    .eq('id', request_id)

  // Delete the animation (participants cascade)
  const { error } = await db
    .from('animations')
    .delete()
    .eq('id', request.animation_id)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'animation.approve_deletion',
    target_type: 'animation',
    target_id: request.animation_id,
    metadata: { title: request.animation?.title, request_id },
  })

  return jsonResponse({ success: true })
})
