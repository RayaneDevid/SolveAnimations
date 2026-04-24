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

  const { animation_id } = await req.json()
  if (!animation_id) return errorResponse('VALIDATION_ERROR', 'animation_id requis')

  const db = getServiceClient()

  const { data: messages, error } = await db
    .from('animation_messages')
    .select(`
      id,
      animation_id,
      user_id,
      content,
      created_at,
      user:profiles!user_id(id, username, avatar_url, role)
    `)
    .eq('animation_id', animation_id)
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse({ messages: messages ?? [] }, 200)
})
