import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { isResponsableRole } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { id } = await req.json().catch(() => ({}))
  if (!id || typeof id !== 'string') return errorResponse('VALIDATION_ERROR', 'id requis')

  const db = getServiceClient()

  const { data: report, error: fetchError } = await db
    .from('trame_reports')
    .select('id, author_id, title')
    .eq('id', id)
    .single()

  if (fetchError || !report) return errorResponse('NOT_FOUND', 'Rapport de trame introuvable')

  const isAuthor = report.author_id === profile.id
  if (!isAuthor && !isResponsableRole(profile.role)) {
    return errorResponse('FORBIDDEN', 'Seul le créateur ou un responsable peut supprimer ce document')
  }

  const { error } = await db.from('trame_reports').delete().eq('id', id)
  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await db.from('audit_log').insert({
    actor_id: profile.id,
    action: 'trame_report.delete',
    target_type: 'trame_report',
    target_id: id,
    metadata: { title: report.title },
  })

  return jsonResponse({ success: true })
})
