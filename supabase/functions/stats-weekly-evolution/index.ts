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

  const body = await req.json().catch(() => ({}))
  const { user_id, weeks = 12 } = body

  const db = getServiceClient()

  // Compute the start of the current week (Saturday 04:00 Europe/Paris)
  const { data: weekStartRow, error: weekErr } = await db
    .rpc('week_start')
    .single()

  if (weekErr || !weekStartRow) {
    return errorResponse('INTERNAL_ERROR', 'Impossible de calculer week_start')
  }

  const weekStart = new Date(weekStartRow as string)
  // Go back `weeks` weeks to get the oldest boundary
  const oldest = new Date(weekStart.getTime() - weeks * 7 * 24 * 60 * 60 * 1000)

  // Build week buckets (oldest first)
  const buckets: Array<{ weekStart: Date; weekEnd: Date; label: string }> = []
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(weekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000)
    // Format "Sem. DD/MM"
    const d = new Date(start)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    buckets.push({ weekStart: start, weekEnd: end, label: `${day}/${month}` })
  }

  const rangeEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString()

  // Always fetch all-users totals
  const { data: allAnims, error: allErr } = await db
    .from('animations')
    .select('ended_at, creator_id')
    .eq('status', 'finished')
    .gte('ended_at', oldest.toISOString())
    .lt('ended_at', rangeEnd)

  if (allErr) {
    return errorResponse('INTERNAL_ERROR', allErr.message)
  }

  // If filtering by user, also fetch user-specific rows (subset of allAnims)
  const userAnims = user_id
    ? (allAnims ?? []).filter((a: { creator_id: string }) => a.creator_id === user_id)
    : allAnims ?? []

  // Count per bucket
  const weekData = buckets.map(({ weekStart, weekEnd, label }) => {
    const inRange = (a: { ended_at: string }) => {
      const t = new Date(a.ended_at).getTime()
      return t >= weekStart.getTime() && t < weekEnd.getTime()
    }
    const count = userAnims.filter(inRange).length
    const total = (allAnims ?? []).filter(inRange).length
    return { weekStart: weekStart.toISOString(), label, count, total }
  })

  // Fetch all staff profiles for the user selector
  const { data: profiles } = await db
    .from('profiles')
    .select('id, username, avatar_url')
    .order('username', { ascending: true })

  return jsonResponse({ weeks: weekData, profiles: profiles ?? [] })
})
