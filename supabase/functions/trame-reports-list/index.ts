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

  const db = getServiceClient()

  const { data, error } = await db
    .from('trame_reports')
    .select(`
      id, title, document_url, author_id, created_at,
      author:profiles!author_id(id, username, avatar_url),
      co_authors:trame_report_co_authors(
        user:profiles(id, username, avatar_url)
      )
    `)
    .order('created_at', { ascending: false })

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  const reports = (data ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    document_url: r.document_url,
    author_id: r.author_id,
    created_at: r.created_at,
    author: r.author,
    co_authors: (r.co_authors as { user: unknown }[]).map((c) => c.user),
  }))

  return jsonResponse(reports)
})
