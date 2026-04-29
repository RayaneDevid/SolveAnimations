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

  const { user_id, pay_pole } = await req.json().catch(() => ({}))

  if (!user_id) return errorResponse('VALIDATION_ERROR', 'user_id requis')
  if (pay_pole !== null && pay_pole !== 'animation' && pay_pole !== 'mj') {
    return errorResponse('VALIDATION_ERROR', 'pay_pole doit être animation, mj ou null')
  }

  const db = getServiceClient()

  const { data: target, error: targetError } = await db
    .from('profiles')
    .select('id, is_active')
    .eq('id', user_id)
    .single()

  if (targetError || !target) return errorResponse('NOT_FOUND', 'Membre introuvable')
  if (!target.is_active) return errorResponse('CONFLICT', 'Ce membre est inactif')

  const { data, error } = await db
    .from('profiles')
    .update({ pay_pole })
    .eq('id', user_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ profile: data })
})
