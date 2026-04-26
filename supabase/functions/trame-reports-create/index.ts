import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

interface Body {
  title: string
  documentUrl: string
  coAuthorIds?: string[]
}

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body: Body = await req.json().catch(() => ({}))
  const { title, documentUrl, coAuthorIds = [] } = body

  if (!title || typeof title !== 'string' || title.trim().length < 3)
    return errorResponse('VALIDATION_ERROR', 'Titre requis (min 3 caractères)')
  if (title.trim().length > 120)
    return errorResponse('VALIDATION_ERROR', 'Titre trop long (max 120 caractères)')
  if (!documentUrl || typeof documentUrl !== 'string')
    return errorResponse('VALIDATION_ERROR', 'Lien du document requis')

  // Vérification basique URL
  try { new URL(documentUrl) } catch {
    return errorResponse('VALIDATION_ERROR', 'Lien du document invalide')
  }

  // L'auteur ne peut pas être dans les co-auteurs
  const filteredCoAuthors = (coAuthorIds as string[]).filter(
    (id) => id !== profile.id && typeof id === 'string',
  )

  const db = getServiceClient()

  const { data: report, error: reportError } = await db
    .from('trame_reports')
    .insert({ title: title.trim(), document_url: documentUrl, author_id: profile.id })
    .select('id, title, document_url, author_id, created_at')
    .single()

  if (reportError || !report)
    return errorResponse('INTERNAL_ERROR', reportError?.message ?? 'Création échouée')

  if (filteredCoAuthors.length > 0) {
    await db.from('trame_report_co_authors').insert(
      filteredCoAuthors.map((user_id) => ({ report_id: report.id, user_id })),
    )
  }

  // Refetch avec auteur + co-auteurs pour renvoyer la donnée complète
  const { data: full } = await db
    .from('trame_reports')
    .select(`
      id, title, document_url, author_id, created_at,
      author:profiles!author_id(id, username, avatar_url),
      co_authors:trame_report_co_authors(
        user:profiles(id, username, avatar_url)
      )
    `)
    .eq('id', report.id)
    .single()

  const shaped = full ? shapeReport(full) : report

  return jsonResponse({ report: shaped })
})

function shapeReport(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    document_url: r.document_url,
    author_id: r.author_id,
    created_at: r.created_at,
    author: r.author,
    co_authors: ((r.co_authors as { user: unknown }[]) ?? []).map((c) => c.user),
  }
}
