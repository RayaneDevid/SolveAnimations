import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { errorResponse } from './errorResponse.ts'
import { getServiceClient } from './supabaseClient.ts'

export type Profile = {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  role: 'responsable' | 'responsable_mj' | 'senior' | 'mj_senior' | 'animateur' | 'mj'
  last_role_check_at: string
}

export async function requireAuth(req: Request): Promise<Profile | Response> {
  const authorization = req.headers.get('Authorization')
  if (!authorization) return errorResponse('UNAUTHORIZED', 'Missing Authorization header')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } } },
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return errorResponse('UNAUTHORIZED', 'Invalid session')

  const db = getServiceClient()
  const { data: profile } = await db
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  if (!profile) return errorResponse('FORBIDDEN', 'No staff profile found')
  return profile as Profile
}
