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

  const { user_id } = await req.json().catch(() => ({}))
  if (!user_id || typeof user_id !== 'string') {
    return errorResponse('VALIDATION_ERROR', 'user_id requis')
  }

  const db = getServiceClient()
  const { data, error } = await db
    .from('user_warnings')
    .select(`
      id, user_id, created_by, warning_date, reason, created_at,
      creator:profiles!user_warnings_created_by_fkey(id, username, avatar_url)
    `)
    .eq('user_id', user_id)
    .order('warning_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(data ?? [])
})
