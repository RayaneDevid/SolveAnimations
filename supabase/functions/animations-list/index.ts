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
    as_participant,
    order = 'desc',
    page = 1,
    pageSize = 20,
  } = body

  const db = getServiceClient()

  // When as_participant=true, restrict to animations where the user has a validated participation
  let participantAnimationIds: string[] | null = null
  if (as_participant) {
    const { data: participations } = await db
      .from('animation_participants')
      .select('animation_id')
      .eq('user_id', profile.id)
      .eq('status', 'validated')
    participantAnimationIds = (participations ?? []).map((p: { animation_id: string }) => p.animation_id)
    if (participantAnimationIds.length === 0) {
      return jsonResponse({ animations: [], total: 0, page, pageSize })
    }
  }

  let query = db
    .from('animations')
    .select(`
      *,
      creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role)
    `, { count: 'exact' })
    .order('scheduled_at', { ascending: order === 'asc' })

  if (participantAnimationIds) query = query.in('id', participantAnimationIds)
  if (Array.isArray(status) && status.length > 0) query = query.in('status', status)
  else if (status) query = query.eq('status', status)
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

  // Fetch validated participant counts + current user's status for this page
  const ids = (animations ?? []).map((a: { id: string }) => a.id)
  let validatedCounts: Record<string, number> = {}
  let myStatuses: Record<string, string> = {}
  if (ids.length > 0) {
    const { data: participantRows } = await db
      .from('animation_participants')
      .select('animation_id, user_id, status')
      .in('animation_id', ids)
    for (const row of participantRows ?? []) {
      if (row.status === 'validated') {
        validatedCounts[row.animation_id] = (validatedCounts[row.animation_id] ?? 0) + 1
      }
      if (row.user_id === profile.id && ['pending', 'validated'].includes(row.status)) {
        myStatuses[row.animation_id] = row.status
      }
    }
  }

  const animationsWithCounts = (animations ?? []).map((a: Record<string, unknown>) => ({
    ...a,
    validated_participants_count: validatedCounts[a.id as string] ?? 0,
    my_participant_status: myStatuses[a.id as string] ?? null,
  }))

  return jsonResponse({ animations: animationsWithCounts, total: count ?? 0, page, pageSize })
})
