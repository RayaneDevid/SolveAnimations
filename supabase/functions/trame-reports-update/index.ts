import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

interface Body {
  id: string
  title: string
  documentUrl: string
  category?: string
  coAuthorIds?: string[]
  writingTimeMin: number
  validatedBy: string
}

const CATEGORIES = ['clan', 'hors_clan', 'lore', 'bdm', 'autre']

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const body: Body = await req.json().catch(() => ({}))
  const { id, title, documentUrl, category = 'autre', coAuthorIds = [], writingTimeMin, validatedBy } = body

  if (!id || typeof id !== 'string') return errorResponse('VALIDATION_ERROR', 'id requis')
  if (!title || typeof title !== 'string' || title.trim().length < 3)
    return errorResponse('VALIDATION_ERROR', 'Titre requis (min 3 caractères)')
  if (title.trim().length > 120)
    return errorResponse('VALIDATION_ERROR', 'Titre trop long (max 120 caractères)')
  if (!documentUrl || typeof documentUrl !== 'string')
    return errorResponse('VALIDATION_ERROR', 'Lien du document requis')
  if (!Number.isInteger(writingTimeMin) || writingTimeMin < 1 || writingTimeMin > 10_080)
    return errorResponse('VALIDATION_ERROR', "Temps d'écriture invalide")
  if (!validatedBy || typeof validatedBy !== 'string' || validatedBy.trim().length < 2)
    return errorResponse('VALIDATION_ERROR', 'Validateur requis')
  if (!CATEGORIES.includes(category))
    return errorResponse('VALIDATION_ERROR', 'Catégorie invalide')

  try { new URL(documentUrl) } catch {
    return errorResponse('VALIDATION_ERROR', 'Lien du document invalide')
  }

  const db = getServiceClient()

  const { data: existing, error: fetchError } = await db
    .from('trame_reports')
    .select('id, author_id, title')
    .eq('id', id)
    .single()

  if (fetchError || !existing) return errorResponse('NOT_FOUND', 'Rapport de trame introuvable')

  const isAuthor = existing.author_id === profile.id
  if (!isAuthor && !isResponsableRole(profile.role)) {
    return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut modifier ce document')
  }

  const filteredCoAuthors = Array.from(new Set((coAuthorIds as string[]).filter(
    (userId) => userId !== existing.author_id && typeof userId === 'string',
  )))

  const { error: updateError } = await db
    .from('trame_reports')
    .update({
      title: title.trim(),
      document_url: documentUrl,
      category,
      writing_time_min: writingTimeMin,
      validated_by: validatedBy.trim(),
    })
    .eq('id', id)

  if (updateError) return errorResponse('INTERNAL_ERROR', updateError.message)

  const { error: deleteCoAuthorsError } = await db
    .from('trame_report_co_authors')
    .delete()
    .eq('report_id', id)

  if (deleteCoAuthorsError) return errorResponse('INTERNAL_ERROR', deleteCoAuthorsError.message)

  if (filteredCoAuthors.length > 0) {
    const { error: insertError } = await db.from('trame_report_co_authors').insert(
      filteredCoAuthors.map((user_id) => ({ report_id: id, user_id })),
    )
    if (insertError) return errorResponse('INTERNAL_ERROR', insertError.message)
  }

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'trame_report.update',
    target_type: 'trame_report',
    target_id: id,
    metadata: { previous_title: existing.title, title: title.trim() },
  })

  const { data: full, error: fullError } = await db
    .from('trame_reports')
    .select(`
      id, title, document_url, category, author_id, created_at, writing_time_min, validated_by,
      author:profiles!author_id(id, username, avatar_url),
      co_authors:trame_report_co_authors(
        user:profiles(id, username, avatar_url)
      )
    `)
    .eq('id', id)
    .single()

  if (fullError || !full) return errorResponse('INTERNAL_ERROR', fullError?.message ?? 'Mise à jour échouée')

  return jsonResponse({ report: shapeReport(full) })
})

function shapeReport(r: Record<string, unknown>) {
  return {
    id: r.id,
    title: r.title,
    document_url: r.document_url,
    category: r.category ?? 'autre',
    author_id: r.author_id,
    created_at: r.created_at,
    writing_time_min: r.writing_time_min ?? null,
    validated_by: r.validated_by ?? null,
    author: r.author,
    co_authors: ((r.co_authors as { user: unknown }[]) ?? []).map((c) => c.user),
  }
}
