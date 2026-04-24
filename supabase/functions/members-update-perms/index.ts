import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const ALLOWED_FIELDS = ['ig_perms_removed', 'discord_perms_removed'] as const
type AllowedField = typeof ALLOWED_FIELDS[number]

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { user_id, field, value } = await req.json()

  if (!user_id) return errorResponse('VALIDATION_ERROR', 'user_id requis')
  if (!ALLOWED_FIELDS.includes(field)) return errorResponse('VALIDATION_ERROR', 'field invalide')
  if (typeof value !== 'boolean') return errorResponse('VALIDATION_ERROR', 'value doit être un booléen')

  const db = getServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, is_active')
    .eq('id', user_id)
    .single()

  if (!target) return errorResponse('NOT_FOUND', 'Membre introuvable')
  if (target.is_active) return errorResponse('CONFLICT', 'Ce membre est actif')

  const { error } = await db
    .from('profiles')
    .update({ [field as AllowedField]: value })
    .eq('id', user_id)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ success: true })
})
