import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts'

const bodySchema = z.object({
  user_id: z.string().uuid(),
  steam_id: z.string().trim().regex(/^\d{17}$/, 'Steam ID doit contenir 17 chiffres').nullable().optional(),
  arrival_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  gender: z.enum(['homme', 'femme', 'autre']).nullable().optional(),
})

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return errorResponse('VALIDATION_ERROR', parsed.error.errors[0]?.message ?? 'Données invalides')
  }

  const { user_id, ...fields } = parsed.data

  const db = getServiceClient()

  const { data: target } = await db
    .from('profiles')
    .select('id, is_active')
    .eq('id', user_id)
    .single()

  if (!target) return errorResponse('NOT_FOUND', 'Membre introuvable')
  if (!target.is_active) return errorResponse('CONFLICT', 'Ce membre est désactivé')

  const { data, error } = await db
    .from('profiles')
    .update(fields)
    .eq('id', user_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'member.update_profile',
    target_type: 'profile',
    target_id: user_id,
    metadata: fields,
  })

  return jsonResponse({ profile: data })
})
