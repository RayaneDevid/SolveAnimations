import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const AUDIENCES = new Set(['all', 'selected', 'pole_animation', 'pole_mj', 'pole_bdm'])

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  const audience = typeof body.audience === 'string' && AUDIENCES.has(body.audience) ? body.audience : 'all'
  const recipientIds = Array.isArray(body.recipient_ids)
    ? Array.from(new Set(body.recipient_ids.filter((id: unknown) => typeof id === 'string')))
    : []

  if (title.length > 120) return errorResponse('VALIDATION_ERROR', 'Titre trop long')
  if (message.length < 1 || message.length > 2000) {
    return errorResponse('VALIDATION_ERROR', 'Message invalide (1-2000 caractères)')
  }
  if (audience === 'selected' && recipientIds.length === 0) {
    return errorResponse('VALIDATION_ERROR', 'Sélectionne au moins un destinataire')
  }

  const db = getServiceClient()

  if (recipientIds.length > 0) {
    const { count, error: profilesError } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('id', recipientIds)
      .eq('is_active', true)

    if (profilesError) return errorResponse('INTERNAL_ERROR', profilesError.message)
    if ((count ?? 0) !== recipientIds.length) {
      return errorResponse('VALIDATION_ERROR', 'Un ou plusieurs destinataires sont invalides')
    }
  }

  const { data: broadcast, error } = await db
    .from('broadcasts')
    .insert({
      title: title || null,
      message,
      audience,
      created_by: profile.id,
    })
    .select(`
      id, title, message, audience, created_by, created_at, archived_at,
      creator:profiles!broadcasts_created_by_fkey(id, username, avatar_url)
    `)
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  if (audience === 'selected') {
    const { error: recipientsError } = await db
      .from('broadcast_recipients')
      .insert(recipientIds.map((userId) => ({ broadcast_id: broadcast.id, user_id: userId })))

    if (recipientsError) return errorResponse('INTERNAL_ERROR', recipientsError.message)
  }

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'broadcast.create',
    target_type: 'broadcast',
    target_id: broadcast.id,
    metadata: { audience, recipient_count: audience === 'selected' ? recipientIds.length : null },
  })

  return jsonResponse({ broadcast }, 201)
})
