import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { hasAnyRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const SELECT = `
  id, subject, destination, description, creator_id,
  status, decided_by, decided_at, decision_reason, created_at,
  creator:profiles!creator_id(id, username, avatar_url, role),
  decider:profiles!decided_by(id, username, avatar_url)
`

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const db = getServiceClient()

  // Tickets créés par l'utilisateur
  const { data: mine, error: e1 } = await db
    .from('requetes')
    .select(SELECT)
    .eq('creator_id', profile.id)
    .order('created_at', { ascending: false })

  if (e1) return errorResponse('INTERNAL_ERROR', e1.message)

  // Tickets entrants selon le rôle
  let incoming: unknown[] = []

  if (hasAnyRole(profile, ['direction', 'gerance'])) {
    // Voit tout
    const { data, error } = await db
      .from('requetes')
      .select(SELECT)
      .eq('status', 'pending')
      .order('status', { ascending: true }) // pending en premier
      .order('created_at', { ascending: true })

    if (error) return errorResponse('INTERNAL_ERROR', error.message)
    incoming = data ?? []
  } else if (hasAnyRole(profile, ['responsable'])) {
    const { data, error } = await db
      .from('requetes')
      .select(SELECT)
      .eq('destination', 'ra')
      .eq('status', 'pending')
      .order('status', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return errorResponse('INTERNAL_ERROR', error.message)
    incoming = data ?? []
  } else if (hasAnyRole(profile, ['responsable_mj'])) {
    const { data, error } = await db
      .from('requetes')
      .select(SELECT)
      .eq('destination', 'rmj')
      .eq('status', 'pending')
      .order('status', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) return errorResponse('INTERNAL_ERROR', error.message)
    incoming = data ?? []
  }

  return jsonResponse({ mine: mine ?? [], incoming })
})
