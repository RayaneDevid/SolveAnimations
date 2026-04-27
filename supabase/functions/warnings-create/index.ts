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

  const { user_id, warning_date, reason } = await req.json().catch(() => ({}))
  if (!user_id || typeof user_id !== 'string') {
    return errorResponse('VALIDATION_ERROR', 'user_id requis')
  }
  if (!warning_date || typeof warning_date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(warning_date)) {
    return errorResponse('VALIDATION_ERROR', 'Date invalide')
  }
  if (!reason || typeof reason !== 'string' || reason.trim().length < 3 || reason.trim().length > 1000) {
    return errorResponse('VALIDATION_ERROR', 'Raison invalide (3–1000 caractères)')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('user_warnings')
    .insert({
      user_id,
      created_by: profile.id,
      warning_date,
      reason: reason.trim(),
    })
    .select(`
      id, user_id, created_by, warning_date, reason, created_at,
      creator:profiles!user_warnings_created_by_fkey(id, username, avatar_url)
    `)
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'user_warning.create',
    target_type: 'profile',
    target_id: user_id,
    metadata: { warning_date },
  })

  return jsonResponse({ warning: data }, 201)
})
