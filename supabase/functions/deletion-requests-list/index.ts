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

  const isResponsable = ['direction', 'gerance', 'responsable', 'responsable_mj'].includes(profile.role)
  if (!isResponsable)
    return errorResponse('FORBIDDEN', 'Accès réservé aux responsables')

  const db = getServiceClient()

  const { data: requests, error } = await db
    .from('deletion_requests')
    .select(`
      *,
      animation:animations(id, title, status, scheduled_at, server, village, type),
      requester:profiles!deletion_requests_requested_by_fkey(id, username, avatar_url, role)
    `)
    .eq('status', 'pending')
    .order('requested_at', { ascending: true })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ requests: requests ?? [] })
})
