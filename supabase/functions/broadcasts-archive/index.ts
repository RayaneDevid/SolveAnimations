import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { id } = await req.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data, error } = await db
    .from('broadcasts')
    .update({
      archived_at: new Date().toISOString(),
      archived_by: profile.id,
    })
    .eq('id', id)
    .is('archived_at', null)
    .select('id')
    .maybeSingle()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)
  if (!data) return errorResponse('NOT_FOUND', 'Broadcast introuvable')

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'broadcast.archive',
    target_type: 'broadcast',
    target_id: id,
    metadata: {},
  })

  return jsonResponse({ success: true })
})
