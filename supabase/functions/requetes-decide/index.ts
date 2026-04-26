import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const DECIDER_ROLES = ['responsable', 'responsable_mj', 'direction', 'gerance']

interface Body {
  id: string
  decision: 'accepted' | 'refused'
  reason?: string
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  if (!DECIDER_ROLES.includes(profile.role))
    return errorResponse('FORBIDDEN', 'Seuls les responsables peuvent décider des requêtes')

  const body: Body = await req.json().catch(() => ({}))
  const { id, decision, reason } = body

  if (!id || typeof id !== 'string')
    return errorResponse('VALIDATION_ERROR', 'ID de requête manquant')
  if (!['accepted', 'refused'].includes(decision))
    return errorResponse('VALIDATION_ERROR', 'Décision invalide')
  if (decision === 'refused' && (!reason || reason.trim().length < 5))
    return errorResponse('VALIDATION_ERROR', 'Une raison est requise pour un refus (min 5 caractères)')

  const db = getServiceClient()

  // Récupérer la requête pour vérifier la destination
  const { data: requete, error: fetchError } = await db
    .from('requetes')
    .select('id, destination, status')
    .eq('id', id)
    .single()

  if (fetchError || !requete)
    return errorResponse('NOT_FOUND', 'Requête introuvable')
  if (requete.status !== 'pending')
    return errorResponse('CONFLICT', 'Cette requête a déjà été traitée')

  // Vérifier que le responsable a le droit de décider pour cette destination
  if (profile.role === 'responsable' && requete.destination !== 'ra')
    return errorResponse('FORBIDDEN', 'Vous ne pouvez décider que des requêtes RA')
  if (profile.role === 'responsable_mj' && requete.destination !== 'rmj')
    return errorResponse('FORBIDDEN', 'Vous ne pouvez décider que des requêtes RMJ')

  const { data: updated, error: updateError } = await db
    .from('requetes')
    .update({
      status: decision,
      decided_by: profile.id,
      decided_at: new Date().toISOString(),
      decision_reason: reason?.trim() ?? null,
    })
    .eq('id', id)
    .select(`
      id, subject, destination, description, creator_id,
      status, decided_by, decided_at, decision_reason, created_at,
      creator:profiles!creator_id(id, username, avatar_url, role),
      decider:profiles!decided_by(id, username, avatar_url)
    `)
    .single()

  if (updateError || !updated)
    return errorResponse('INTERNAL_ERROR', updateError?.message ?? 'Mise à jour échouée')

  return jsonResponse({ requete: updated })
})
