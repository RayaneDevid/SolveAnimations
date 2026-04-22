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

  const { id } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: absence } = await db
    .from('user_absences')
    .select('user_id')
    .eq('id', id)
    .single()

  if (!absence) return errorResponse('NOT_FOUND', 'Absence introuvable')
  if (absence.user_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Tu ne peux supprimer que tes propres absences')

  const { error } = await db.from('user_absences').delete().eq('id', id)
  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ success: true })
})
