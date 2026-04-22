import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { getGuildMember } from '../_shared/discord.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const authorization = req.headers.get('Authorization')
  if (!authorization) return errorResponse('UNAUTHORIZED', 'Missing Authorization header')

  const anonClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )

  const { data: { user }, error: userError } = await anonClient.auth.getUser()
  if (userError || !user) return errorResponse('UNAUTHORIZED', 'Invalid session')

  const body = await req.json().catch(() => ({}))
  const providerToken: string | undefined = body.provider_token

  const db = getServiceClient()

  // If no provider_token (session restore after page reload), return existing profile
  if (!providerToken) {
    const { data: profile } = await db
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return errorResponse('UNAUTHORIZED', 'Profile not found. Please re-login.')
    }

    return jsonResponse({ profile })
  }

  // Full validation with Discord API
  const memberResult = await getGuildMember(providerToken)
  if (!memberResult.ok) {
    return errorResponse('FORBIDDEN', "Tu n'as pas les rôles nécessaires pour accéder à ce panel.")
  }

  const { data: profile, error: upsertError } = await db
    .from('profiles')
    .upsert({
      id: user.id,
      discord_id: memberResult.discordId,
      username: memberResult.username,
      avatar_url: memberResult.avatarUrl,
      role: memberResult.role,
      last_role_check_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    }, { onConflict: 'id' })
    .select()
    .single()

  if (upsertError || !profile) {
    console.error('Profile upsert error:', upsertError)
    return errorResponse('INTERNAL_ERROR', 'Failed to upsert profile')
  }

  return jsonResponse({ profile })
})
