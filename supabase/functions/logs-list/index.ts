import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const MAX_PAGE_SIZE = 100

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const page = Math.max(1, Number.parseInt(String(body.page ?? '1'), 10) || 1)
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(10, Number.parseInt(String(body.pageSize ?? '50'), 10) || 50))
  const action = typeof body.action === 'string' && body.action.trim() ? body.action.trim() : null
  const actorId = typeof body.actor_id === 'string' && body.actor_id.trim() ? body.actor_id.trim() : null

  const db = getServiceClient()

  let query = db
    .from('audit_log')
    .select(`
      id, actor_id, action, target_type, target_id, metadata, created_at,
      actor:profiles!audit_log_actor_id_fkey(id, username, avatar_url, role)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })

  if (action) query = query.eq('action', action)
  if (actorId) query = query.eq('actor_id', actorId)

  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data, error, count } = await query.range(from, to)
  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  const { data: actionRows, error: actionsError } = await db
    .from('audit_log')
    .select('action')
    .order('action', { ascending: true })
    .limit(1000)

  if (actionsError) return errorResponse('INTERNAL_ERROR', actionsError.message)

  const actions = Array.from(new Set((actionRows ?? []).map((row) => row.action))).sort()
  const total = count ?? 0

  return jsonResponse({
    logs: data ?? [],
    actions,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  })
})
