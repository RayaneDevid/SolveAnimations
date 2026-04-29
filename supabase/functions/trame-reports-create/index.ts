import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

interface Body {
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
  const { title, documentUrl, category = 'autre', coAuthorIds = [], writingTimeMin, validatedBy } = body

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

  // Vérification basique URL
  try { new URL(documentUrl) } catch {
    return errorResponse('VALIDATION_ERROR', 'Lien du document invalide')
  }

  // L'auteur ne peut pas être dans les co-auteurs
  const filteredCoAuthors = (coAuthorIds as string[]).filter(
    (id) => id !== profile.id && typeof id === 'string',
  )

  const db = getServiceClient()

  const validatedByTrimmed = validatedBy.trim()

  const { data: report, error: reportError } = await db
    .from('trame_reports')
    .insert({
      title: title.trim(),
      document_url: documentUrl,
      category,
      author_id: profile.id,
      writing_time_min: writingTimeMin,
      validated_by: validatedByTrimmed,
    })
    .select('id, title, document_url, category, author_id, created_at, writing_time_min, validated_by')
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
      id, title, document_url, category, author_id, created_at, writing_time_min, validated_by,
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
    category: r.category ?? 'autre',
    author_id: r.author_id,
    created_at: r.created_at,
    writing_time_min: r.writing_time_min ?? null,
    validated_by: r.validated_by ?? null,
    author: r.author,
    co_authors: ((r.co_authors as { user: unknown }[]) ?? []).map((c) => c.user),
  }
}
