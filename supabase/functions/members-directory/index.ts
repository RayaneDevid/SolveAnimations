import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

// Lightweight active staff directory for selectors visible to every panel user.
Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const db = getServiceClient()

  const { data, error } = await db
    .from('profiles')
    .select('id, username, avatar_url, role')
    .eq('is_active', true)
    .order('username', { ascending: true })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  return jsonResponse((data ?? []).map((member) => ({
    id: member.id,
    username: member.username,
    avatarUrl: member.avatar_url,
    role: member.role,
  })))
})
