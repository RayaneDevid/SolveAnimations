import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { notifyBot } from '../_shared/bot.ts'

const REMINDER_WINDOW_MIN = 15
const REMINDER_SECRET = Deno.env.get('ANIMATION_REMINDER_SECRET')

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  if (REMINDER_SECRET && req.headers.get('x-reminder-secret') !== REMINDER_SECRET) {
    return errorResponse('FORBIDDEN', 'Secret invalide')
  }

  const db = getServiceClient()
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000)

  const { data: animations, error } = await db
    .from('animations')
    .select(`
      id, title, scheduled_at, server, village,
      participants:animation_participants!animation_participants_animation_id_fkey(
        status,
        user:profiles!animation_participants_user_id_fkey(discord_id)
      )
    `)
    .in('status', ['open', 'preparing'])
    .is('reminder_15min_sent_at', null)
    .gt('scheduled_at', now.toISOString())
    .lte('scheduled_at', windowEnd.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(25)

  if (error) return errorResponse('INTERNAL_ERROR', error.message)

  let reminded = 0
  let skipped = 0

  for (const animation of animations ?? []) {
    const { data: claimed, error: claimError } = await db
      .from('animations')
      .update({ reminder_15min_sent_at: new Date().toISOString() })
      .eq('id', animation.id)
      .is('reminder_15min_sent_at', null)
      .select('id')
      .maybeSingle()

    if (claimError || !claimed) {
      skipped++
      continue
    }

    const participants = (animation.participants ?? []) as Array<{
      status?: string
      user?: { discord_id?: string | null } | null
    }>

    const participantDiscordIds = [...new Set(
      participants
        .filter((participant) => participant.status === 'validated')
        .map((participant) => participant.user?.discord_id)
        .filter((discordId): discordId is string => typeof discordId === 'string' && discordId.length > 0),
    )]

    if (participantDiscordIds.length > 0) {
      const botResult = await notifyBot('animation-reminder', {
        animationId: animation.id,
        title: animation.title,
        scheduledAt: animation.scheduled_at,
        server: animation.server,
        village: animation.village,
        participantDiscordIds,
      })

      if (!botResult) {
        skipped++
        continue
      }
    }

    reminded++
  }

  return jsonResponse({ checked: animations?.length ?? 0, reminded, skipped })
})
