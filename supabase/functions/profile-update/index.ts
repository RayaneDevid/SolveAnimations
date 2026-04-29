import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const bodySchema = z.object({
  steam_id: z.string().trim().regex(/^\d{17}$/, 'Steam ID doit contenir 17 chiffres').nullable().optional(),
  arrival_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.enum(['homme', 'femme', 'autre']).nullable().optional(),
  primary_role: z.enum(['direction', 'gerance', 'responsable', 'responsable_mj', 'responsable_bdm', 'senior', 'mj_senior', 'animateur', 'mj', 'bdm']).optional(),
})

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Données invalides')
  }

  const db = getServiceClient()
  const { primary_role, ...profilePatch } = parsed.data
  const patch: Record<string, unknown> = { ...profilePatch }

  if (primary_role) {
    const availableRoles = Array.isArray(profile.available_roles) ? profile.available_roles : []
    const canUseRole = availableRoles.includes(primary_role) || primary_role === profile.role
    if (!canUseRole) {
      return errorResponse('FORBIDDEN', "Tu ne peux choisir qu'un rôle que tu possèdes sur Discord.")
    }
    patch.role = primary_role
  }

  const { data, error } = await db
    .from('profiles')
    .update(patch)
    .eq('id', profile.id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ profile: data })
})
