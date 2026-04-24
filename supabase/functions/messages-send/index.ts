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

  const { animation_id, content } = await req.json()

  if (!animation_id) return errorResponse('VALIDATION_ERROR', 'animation_id requis')
  if (!content || typeof content !== 'string') return errorResponse('VALIDATION_ERROR', 'content requis')

  const trimmed = content.trim()
  if (trimmed.length < 1) return errorResponse('VALIDATION_ERROR', 'Le message ne peut pas être vide')
  if (trimmed.length > 1000) return errorResponse('VALIDATION_ERROR', 'Le message ne peut pas dépasser 1000 caractères')

  const db = getServiceClient()

  // Verify the animation exists and the user has access (any staff can see it)
  const { data: anim } = await db
    .from('animations')
    .select('id')
    .eq('id', animation_id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')

  const { data: message, error } = await db
    .from('animation_messages')
    .insert({
      animation_id,
      user_id: profile.id,
      content: trimmed,
    })
    .select(`
      id,
      animation_id,
      user_id,
      content,
      created_at,
      user:profiles!user_id(id, username, avatar_url, role)
    `)
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ message }, 201)
})
