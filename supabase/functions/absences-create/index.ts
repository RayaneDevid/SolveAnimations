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

  const { from_date, to_date, reason } = await req.json()

  if (!from_date || !to_date)
    return errorResponse('VALIDATION_ERROR', 'from_date et to_date requis')
  if (new Date(to_date) < new Date(from_date))
    return errorResponse('VALIDATION_ERROR', 'to_date doit être >= from_date')
  if (reason && reason.length > 300)
    return errorResponse('VALIDATION_ERROR', 'Motif trop long (max 300)')

  const db = getServiceClient()

  const { data, error } = await db
    .from('user_absences')
    .insert({
      user_id: profile.id,
      from_date,
      to_date,
      reason: reason?.trim() || null,
    })
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ absence: data }, 201)
})
