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
    .select('user_id, from_date, to_date')
    .eq('id', id)
    .single()

  if (!absence) return errorResponse('NOT_FOUND', 'Absence introuvable')
  if (absence.user_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Tu ne peux marquer le retour que sur tes propres absences')

  const today = parisDateString(new Date())
  if (absence.to_date <= today) {
    return jsonResponse({ success: true })
  }
  if (absence.from_date > today) {
    return errorResponse('CONFLICT', "Cette absence n'a pas encore commencé")
  }

  const { error } = await db
    .from('user_absences')
    .update({ to_date: today })
    .eq('id', id)
  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ success: true })
})

function parisDateString(date: Date): string {
  const parts = new Intl.DateTimeFormat('fr-FR', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const year = parts.find((part) => part.type === 'year')?.value
  const month = parts.find((part) => part.type === 'month')?.value
  const day = parts.find((part) => part.type === 'day')?.value
  return `${year}-${month}-${day}`
}
