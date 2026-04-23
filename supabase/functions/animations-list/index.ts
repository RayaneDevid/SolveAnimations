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

  const body = await req.json().catch(() => ({}))
  const {
    status,
    server,
    village,
    type,
    creator_id,
    from,
    to,
    page = 1,
    pageSize = 20,
  } = body

  const db = getServiceClient()
  let query = db
    .from('animations')
    .select(`
      *,
      creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role)
    `, { count: 'exact' })
    .order('scheduled_at', { ascending: false })

  if (status)     query = query.eq('status', status)
  if (server)     query = query.eq('server', server)
  if (village)    query = query.eq('village', village)
  if (type)       query = query.eq('type', type)
  if (creator_id) query = query.eq('creator_id', creator_id)
  if (from)       query = query.gte('scheduled_at', from)
  if (to)         query = query.lte('scheduled_at', to)

  const offset = (page - 1) * pageSize
  query = query.range(offset, offset + pageSize - 1)

  const { data: animations, error, count } = await query

  if (error) {
    console.error('animations-list error:', error)
    return errorResponse('INTERNAL_ERROR', error.message)
  }

  // Fetch validated participant counts for this page
  const ids = (animations ?? []).map((a: { id: string }) => a.id)
  let validatedCounts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: participantRows } = await db
      .from('animation_participants')
      .select('animation_id')
      .in('animation_id', ids)
      .eq('status', 'validated')
    for (const row of participantRows ?? []) {
      validatedCounts[row.animation_id] = (validatedCounts[row.animation_id] ?? 0) + 1
    }
  }

  const animationsWithCounts = (animations ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    validated_participants_count: validatedCounts[a.id as string] ?? 0,
  }))

  return jsonResponse({ animations: animationsWithCounts, total: count ?? 0, page, pageSize })
})
