import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'
import { syncEmbed } from '../_shared/syncEmbed.ts'

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const { id, new_scheduled_at } = await req.json()
  if (!id) return errorResponse('VALIDATION_ERROR', 'id requis')
  if (!new_scheduled_at || new Date(new_scheduled_at).getTime() <= Date.now())
    return errorResponse('VALIDATION_ERROR', 'Nouvelle date invalide (doit être dans le futur)')

  const db = getServiceClient()

  const { data: anim } = await db
    .from('animations')
    .select('*')
    .eq('id', id)
    .single()

  if (!anim) return errorResponse('NOT_FOUND', 'Animation introuvable')
  if (anim.creator_id !== profile.id)
    return errorResponse('FORBIDDEN', 'Seul le créateur peut reporter')
  if (anim.status !== 'open')
    return errorResponse('CONFLICT', "L'animation doit être ouverte pour être reportée")

  // Get current participants to DM them
  const { data: participants } = await db
    .from('animation_participants')
    .select('user_id, user:profiles!animation_participants_user_id_fkey(discord_id)')
    .eq('animation_id', id)
    .in('status', ['pending', 'validated'])

  const formerDiscordIds = (participants ?? [])
    .map((p: { user?: { discord_id?: string } }) => p.user?.discord_id)
    .filter(Boolean)

  // Set all pending/validated participants to removed
  await db
    .from('animation_participants')
    .update({ status: 'removed', decided_at: new Date().toISOString(), decided_by: profile.id })
    .eq('animation_id', id)
    .in('status', ['pending', 'validated'])

  const { data: updated, error } = await db
    .from('animations')
    .update({
      scheduled_at: new_scheduled_at,
      postponed_from: anim.scheduled_at,
      postpone_count: (anim.postpone_count ?? 0) + 1,
      reminder_15min_sent_at: null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  await syncEmbed(db, id)
  await notifyBot('animation-postponed', {
    animationId: id,
    newScheduledAt: new_scheduled_at,
    title: anim.title,
    formerParticipantDiscordIds: formerDiscordIds,
  })

  return jsonResponse({ animation: updated })
})
