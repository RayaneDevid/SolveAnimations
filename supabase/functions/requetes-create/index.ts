import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const CREATOR_ROLES = ['animateur', 'mj', 'senior', 'mj_senior']

const VALID_SUBJECTS = [
  'grade_superieur_tkj',
  'demande_give',
  'setmodel_tenue',
  'reservation_secteur',
  'situation_problematique',
]

const VALID_DESTINATIONS = ['ra', 'rmj']

interface Body {
  subject: string
  destination: string
  description: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  if (!CREATOR_ROLES.includes(profile.role))
    return errorResponse('FORBIDDEN', 'Seuls les animateurs, MJ, seniors peuvent créer des requêtes')

  const body: Body = await req.json().catch(() => ({}))
  const { subject, destination, description } = body

  if (!VALID_SUBJECTS.includes(subject))
    return errorResponse('VALIDATION_ERROR', 'Sujet invalide')
  if (!VALID_DESTINATIONS.includes(destination))
    return errorResponse('VALIDATION_ERROR', 'Destination invalide')
  if (!description || description.trim().length < 10)
    return errorResponse('VALIDATION_ERROR', 'Description trop courte (min 10 caractères)')
  if (description.length > 2000)
    return errorResponse('VALIDATION_ERROR', 'Description trop longue (max 2000 caractères)')

  const db = getServiceClient()

  const { data, error } = await db
    .from('requetes')
    .insert({
      subject,
      destination,
      description: description.trim(),
      creator_id: profile.id,
    })
    .select(`
      id, subject, destination, description, creator_id,
      status, decided_by, decided_at, decision_reason, created_at,
      creator:profiles!creator_id(id, username, avatar_url, role)
    `)
    .single()

  if (error || !data)
    return errorResponse('INTERNAL_ERROR', error?.message ?? 'Création échouée')

  return jsonResponse({ requete: data })
})
