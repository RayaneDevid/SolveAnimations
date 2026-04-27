import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { report_id, character_name, comments } = await req.json()
  if (!report_id) return errorResponse('VALIDATION_ERROR', 'report_id requis')
  if (!character_name || character_name.trim().length === 0)
    return errorResponse('VALIDATION_ERROR', 'Nom du personnage requis')
  if (character_name.trim().length > 64)
    return errorResponse('VALIDATION_ERROR', 'Nom du personnage trop long (max 64)')

  const db = getServiceClient()

  const { data: report } = await db
    .from('animation_reports')
    .select('*')
    .eq('id', report_id)
    .single()

  if (!report) return errorResponse('NOT_FOUND', 'Rapport introuvable')
  if (report.user_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Ce rapport ne t\'appartient pas')

  const wasSubmitted = !!report.submitted_at

  const { data: updated, error } = await db
    .from('animation_reports')
    .update({
      character_name: character_name.trim(),
      comments: comments?.trim() ?? null,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', report_id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  if (!wasSubmitted) {
    const { data: fullReport } = await db
      .from('animation_reports')
      .select(`
        id, animation_id, pole, character_name, comments, submitted_at,
        animation:animations!animation_reports_animation_id_fkey(title)
      `)
      .eq('id', report_id)
      .single()

    await notifyBot('report-submitted', {
      reportId: updated.id,
      animationId: updated.animation_id,
      animationTitle: fullReport?.animation?.title ?? 'Animation',
      username: profile.username,
      characterName: updated.character_name,
      comments: updated.comments,
      pole: updated.pole,
      submittedAt: updated.submitted_at,
    })
  }

  return jsonResponse({ report: updated })
})
