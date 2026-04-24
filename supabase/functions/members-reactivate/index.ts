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

  const { user_id } = await req.json()
  if (!user_id) return errorResponse('VALIDATION_ERROR', 'user_id requis')

  const db = getServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, username, is_active')
    .eq('id', user_id)
    .single()

  if (!target) return errorResponse('NOT_FOUND', 'Membre introuvable')
  if (target.is_active) return errorResponse('CONFLICT', 'Ce membre est déjà actif')

  const { error } = await db
    .from('profiles')
    .update({
      is_active: true,
      deactivated_at: null,
      deactivation_reason: null,
      deactivated_by: null,
    })
    .eq('id', user_id)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'member.reactivate',
    target_type: 'profile',
    target_id: target.id,
    metadata: { username: target.username },
  })

  return jsonResponse({ success: true })
})
