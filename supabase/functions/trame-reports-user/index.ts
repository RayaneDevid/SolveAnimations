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

  const body: { user_id?: string } = await req.json().catch(() => ({}))
  const userId = body.user_id ?? profile.id

  if (typeof userId !== 'string')
    return errorResponse('VALIDATION_ERROR', 'user_id invalide')

  const db = getServiceClient()

  // Rapports où l'utilisateur est auteur
  const { data: asAuthor, error: e1 } = await db
    .from('trame_reports')
    .select(`
      id, title, document_url, author_id, created_at, writing_time_min, validated_by,
      author:profiles!author_id(id, username, avatar_url),
      co_authors:trame_report_co_authors(
        user:profiles(id, username, avatar_url)
      )
    `)
    .eq('author_id', userId)
    .order('created_at', { ascending: false })

  if (e1) return errorResponse('INTERNAL_ERROR', e1.message)

  // Rapports où l'utilisateur est co-auteur
  const { data: coAuthorLinks, error: e2 } = await db
    .from('trame_report_co_authors')
    .select('report_id')
    .eq('user_id', userId)

  if (e2) return errorResponse('INTERNAL_ERROR', e2.message)

  const coAuthorReportIds = (coAuthorLinks ?? []).map((c) => c.report_id)

  let asCoAuthor: typeof asAuthor = []
  if (coAuthorReportIds.length > 0) {
    const { data, error: e3 } = await db
      .from('trame_reports')
      .select(`
        id, title, document_url, author_id, created_at, writing_time_min, validated_by,
        author:profiles!author_id(id, username, avatar_url),
        co_authors:trame_report_co_authors(
          user:profiles(id, username, avatar_url)
        )
      `)
      .in('id', coAuthorReportIds)
      .order('created_at', { ascending: false })

    if (e3) return errorResponse('INTERNAL_ERROR', e3.message)
    asCoAuthor = data ?? []
  }

  // Fusionner, dédoublonner et trier par date desc
  const seen = new Set<string>()
  const merged = [...(asAuthor ?? []), ...asCoAuthor]
    .filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true })
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  const reports = merged.map((r) => ({
    id: r.id,
    title: r.title,
    document_url: r.document_url,
    author_id: r.author_id,
    created_at: r.created_at,
    writing_time_min: r.writing_time_min ?? null,
    validated_by: r.validated_by ?? null,
    author: r.author,
    co_authors: (r.co_authors as { user: unknown }[]).map((c) => c.user),
  }))

  return jsonResponse(reports)
})
