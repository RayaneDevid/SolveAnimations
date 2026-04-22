import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const authorization = req.headers.get('Authorization')
  if (!authorization) {
    return errorResponse('UNAUTHORIZED', 'Missing Authorization header')
  }

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )

  const { data: { user }, error: userError } = await anonClient.auth.getUser()
  if (userError || !user) return errorResponse('UNAUTHORIZED', 'Invalid session')

  const db = getServiceClient()
  const { data: profile, error: profileError } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    return errorResponse('UNAUTHORIZED', 'Profile not found. Please re-login.')
  }

  return jsonResponse({ profile })
})
