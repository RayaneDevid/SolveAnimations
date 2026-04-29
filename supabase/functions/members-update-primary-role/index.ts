import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const STAFF_ROLES = [
  'direction',
  'gerance',
  'responsable',
  'responsable_mj',
  'responsable_bdm',
  'senior',
  'mj_senior',
  'animateur',
  'mj',
  'bdm',
] as const

type StaffRole = typeof STAFF_ROLES[number]

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const { user_id, role } = await req.json().catch(() => ({}))

  if (!user_id) return errorResponse('VALIDATION_ERROR', 'user_id requis')
  if (!STAFF_ROLES.includes(role)) return errorResponse('VALIDATION_ERROR', 'role invalide')

  const db = getServiceClient()

  const { data: target, error: targetError } = await db
    .from('profiles')
    .select('id, role, available_roles, is_active')
    .eq('id', user_id)
    .single()

  if (targetError || !target) return errorResponse('NOT_FOUND', 'Membre introuvable')
  if (!target.is_active) return errorResponse('CONFLICT', 'Ce membre est inactif')

  const availableRoles = Array.isArray(target.available_roles) && target.available_roles.length > 0
    ? target.available_roles as StaffRole[]
    : [target.role as StaffRole]

  if (!availableRoles.includes(role)) {
    return errorResponse('FORBIDDEN', "Ce membre ne possède pas ce rôle Discord.")
  }

  const { data, error } = await db
    .from('profiles')
    .update({ role })
    .eq('id', user_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ profile: data })
})
