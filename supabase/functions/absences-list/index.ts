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

  const body = await req.json().catch(() => ({}))
  const { user_id } = body

  // Only responsable can query other users' absences
  if (user_id && user_id !== profile.id && profile.role !== 'responsable' && profile.role !== 'responsable_mj')
    return errorResponse('FORBIDDEN', 'Accès refusé')

  const targetId = user_id ?? profile.id

  const db = getServiceClient()
  const { data, error } = await db
    .from('user_absences')
    .select('*')
    .eq('user_id', targetId)
    .order('from_date', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse(data ?? [])
})
