import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'

const VILLAGES = ['konoha', 'suna', 'oto', 'kiri', 'temple_camelias', 'autre', 'tout_le_monde'] as const

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  if (profile.role !== 'responsable')
    return errorResponse('FORBIDDEN', 'Accès réservé aux responsables')

  const db = getServiceClient()

  const now = new Date()
  const weekStart = computeWeekStart(now)
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000)

  // Current week
  const { data: currentAnims } = await db
    .from('animations')
    .select('village')
    .eq('status', 'finished')
    .gte('ended_at', weekStart.toISOString())
    .lt('ended_at', weekEnd.toISOString())

  const currentCounts = buildCounts(currentAnims ?? [])
  const currentTotal = Object.values(currentCounts).reduce((s, v) => s + v, 0)
  const currentByVillage = buildPercentages(currentCounts, currentTotal)

  // Last 4 weeks (not including current)
  const lastFourWeeks = []
  for (let i = 1; i <= 4; i++) {
    const wStart = new Date(weekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000)
    const wEnd = new Date(wStart.getTime() + 7 * 24 * 60 * 60 * 1000)

    const { data: anims } = await db
      .from('animations')
      .select('village')
      .eq('status', 'finished')
      .gte('ended_at', wStart.toISOString())
      .lt('ended_at', wEnd.toISOString())

    const counts = buildCounts(anims ?? [])
    const total = Object.values(counts).reduce((s, v) => s + v, 0)
    lastFourWeeks.push({
      weekStart: wStart.toISOString(),
      byVillage: buildPercentages(counts, total),
      counts,
    })
  }

  return jsonResponse({
    currentWeek: {
      start: weekStart.toISOString(),
      end: weekEnd.toISOString(),
      byVillage: currentByVillage,
      counts: currentCounts,
    },
    lastFourWeeks,
  })
})

function buildCounts(anims: { village: string }[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const v of VILLAGES) counts[v] = 0
  for (const a of anims) {
    if (a.village in counts) counts[a.village]++
  }
  return counts
}

function buildPercentages(counts: Record<string, number>, total: number): Record<string, number> {
  const pct: Record<string, number> = {}
  for (const [k, v] of Object.entries(counts)) {
    pct[k] = total > 0 ? Math.round((v / total) * 1000) / 10 : 0
  }
  return pct
}

function computeWeekStart(now: Date): Date {
  const parisStr = now.toLocaleString('en-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
    hour12: false,
  })
  const [date, time] = parisStr.split(', ')
  const [y, m, d] = date.split('-').map(Number)
  const h = parseInt(time.split(':')[0])
  const localDate = new Date(y, m - 1, d, h, 0, 0)
  const dow = localDate.getDay()
  const daysSinceSat = (dow + 1) % 7
  const anchor = new Date(y, m - 1, d - daysSinceSat, 4, 0, 0)
  if (anchor > localDate) anchor.setDate(anchor.getDate() - 7)
  const anchorStr = `${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}T04:00:00`
  return new Date(new Date(anchorStr).toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
}
