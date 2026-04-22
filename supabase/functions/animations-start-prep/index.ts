import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { id } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.creator_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Seul le créateur peut démarrer la préparation')
  if (anim.status !== 'open')
    return errorResponse('CONFLICT', "L'animation doit être ouverte pour démarrer la préparation")
  if (anim.prep_started_at)
    return errorResponse('CONFLICT', 'La préparation a déjà été démarrée')

  const { data: updated, error } = await db
    .from('animations')
    .update({ status: 'preparing', prep_started_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, id)

  return jsonResponse({ animation: updated })
})
