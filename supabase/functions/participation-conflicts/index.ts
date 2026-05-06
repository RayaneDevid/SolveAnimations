import { handleCors } from '../_shared/cors.ts'
import { jsonResponse } from '../_shared/jsonResponse.ts'
import { errorResponse } from '../_shared/errorResponse.ts'
import { requireAuth } from '../_shared/auth.ts'
import { requireResponsable } from '../_shared/guards.ts'
import { getServiceClient } from '../_shared/supabaseClient.ts'
import { weekStartFor } from '../_shared/week.ts'

type AnimRow = {
  id: string
  title: string
  scheduled_at: string
  planned_duration_min: number | null
  prep_time_min: number | null
  status: string
  bdm_mission: boolean | null
  creator_id: string
  creator: { id: string; username: string; avatar_url: string | null; role: string } | null
}

type Slot = {
  animationId: string
  title: string
  startMs: number
  endMs: number
  scheduledAt: string
  plannedDurationMin: number
  prepTimeMin: number
  status: string
  bdmMission: boolean
  role: 'creator' | 'participant'
  participantStatus?: 'pending' | 'validated'
}

const ACTIVE_STATUSES = ['pending_validation', 'open', 'preparing', 'running', 'finished']

Deno.serve(async (req) => {
  const cors = handleCors(req)
  if (cors) return cors

  const profile = await requireAuth(req)
  if (profile instanceof Response) return profile

  const guard = requireResponsable(profile)
  if (guard) return guard

  const body = await req.json().catch(() => ({}))
  const weekStart = body.week_start ? new Date(body.week_start) : weekStartFor(new Date())
  if (Number.isNaN(weekStart.getTime()))
    return errorResponse('VALIDATION_ERROR', 'week_start invalide')
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 3_600_000)

  const db = getServiceClient()

  // Pull all animations whose slot intersects the week. Use a wide scheduled_at window
  // (week ± 1 day) to catch animations starting just before / lasting past the boundary.
  const fromIso = new Date(weekStart.getTime() - 24 * 3_600_000).toISOString()
  const toIso = new Date(weekEnd.getTime() + 24 * 3_600_000).toISOString()

  const { data: anims, error: animsError } = await db
    .from('animations')
    .select(`
      id, title, scheduled_at, planned_duration_min, prep_time_min, status, bdm_mission, creator_id,
      creator:profiles!animations_creator_id_fkey(id, username, avatar_url, role)
    `)
    .in('status', ACTIVE_STATUSES)
    .gte('scheduled_at', fromIso)
    .lt('scheduled_at', toIso)

  if (animsError) return errorResponse('INTERNAL_ERROR', animsError.message)

  const animsList = (anims ?? []) as unknown as AnimRow[]
  const animById = new Map(animsList.map((a) => [a.id, a]))
  const animIds = animsList.map((a) => a.id)

  if (animIds.length === 0) return jsonResponse({ conflicts: [] })

  const { data: parts, error: partsError } = await db
    .from('animation_participants')
    .select('user_id, animation_id, status, profile:profiles!animation_participants_user_id_fkey(id, username, avatar_url, role)')
    .in('animation_id', animIds)
    .in('status', ['pending', 'validated'])

  if (partsError) return errorResponse('INTERNAL_ERROR', partsError.message)

  type UserInfo = { id: string; username: string; avatarUrl: string | null; role: string }
  const slotsByUser = new Map<string, Slot[]>()
  const userInfo = new Map<string, UserInfo>()

  const intersects = (startMs: number, endMs: number): boolean => {
    const winStart = weekStart.getTime()
    const winEnd = weekEnd.getTime()
    return startMs < winEnd && endMs > winStart
  }

  const animSlot = (a: AnimRow, role: 'creator' | 'participant', participantStatus?: 'pending' | 'validated'): Slot => {
    const startMs = new Date(a.scheduled_at).getTime() - (a.prep_time_min ?? 0) * 60_000
    const endMs = new Date(a.scheduled_at).getTime() + (a.planned_duration_min ?? 0) * 60_000
    return {
      animationId: a.id,
      title: a.title,
      startMs,
      endMs,
      scheduledAt: a.scheduled_at,
      plannedDurationMin: a.planned_duration_min ?? 0,
      prepTimeMin: a.prep_time_min ?? 0,
      status: a.status,
      bdmMission: !!a.bdm_mission,
      role,
      participantStatus,
    }
  }

  // Creators are implicit participants in their own slot
  for (const a of animsList) {
    if (!a.creator) continue
    const slot = animSlot(a, 'creator')
    if (!intersects(slot.startMs, slot.endMs)) continue
    const list = slotsByUser.get(a.creator.id) ?? []
    list.push(slot)
    slotsByUser.set(a.creator.id, list)
    if (!userInfo.has(a.creator.id)) {
      userInfo.set(a.creator.id, {
        id: a.creator.id,
        username: a.creator.username,
        avatarUrl: a.creator.avatar_url,
        role: a.creator.role,
      })
    }
  }

  // Validated and pending participants
  for (const p of (parts ?? []) as Array<{
    user_id: string
    animation_id: string
    status: 'pending' | 'validated'
    profile: { id: string; username: string; avatar_url: string | null; role: string } | null
  }>) {
    const a = animById.get(p.animation_id)
    if (!a || !p.profile) continue
    const slot = animSlot(a, 'participant', p.status)
    if (!intersects(slot.startMs, slot.endMs)) continue
    const list = slotsByUser.get(p.user_id) ?? []
    list.push(slot)
    slotsByUser.set(p.user_id, list)
    if (!userInfo.has(p.user_id)) {
      userInfo.set(p.user_id, {
        id: p.profile.id,
        username: p.profile.username,
        avatarUrl: p.profile.avatar_url,
        role: p.profile.role,
      })
    }
  }

  // For each user, sort slots by start and group those that pairwise overlap
  type Conflict = { user: UserInfo; animations: Slot[] }
  const conflicts: Conflict[] = []

  for (const [userId, slots] of slotsByUser.entries()) {
    if (slots.length < 2) continue
    // Deduplicate (creator + participant on same anim shouldn't happen, but be defensive)
    const unique = new Map<string, Slot>()
    for (const s of slots) {
      const existing = unique.get(s.animationId)
      if (!existing || (existing.role === 'participant' && s.role === 'creator')) unique.set(s.animationId, s)
    }
    const sorted = Array.from(unique.values()).sort((a, b) => a.startMs - b.startMs)

    // Build maximal overlap clusters: scan with a running max-end; whenever next.start < runningEnd → same cluster
    const clusters: Slot[][] = []
    let current: Slot[] = []
    let currentEnd = -Infinity
    for (const slot of sorted) {
      if (current.length === 0 || slot.startMs < currentEnd) {
        current.push(slot)
        currentEnd = Math.max(currentEnd, slot.endMs)
      } else {
        if (current.length >= 2) clusters.push(current)
        current = [slot]
        currentEnd = slot.endMs
      }
    }
    if (current.length >= 2) clusters.push(current)

    if (clusters.length === 0) continue
    const info = userInfo.get(userId)
    if (!info) continue
    for (const cluster of clusters) {
      conflicts.push({ user: info, animations: cluster })
    }
  }

  // Stable order: by user, then earliest slot
  conflicts.sort((a, b) => {
    const aMin = Math.min(...a.animations.map((s) => s.startMs))
    const bMin = Math.min(...b.animations.map((s) => s.startMs))
    return aMin - bMin || a.user.username.localeCompare(b.user.username)
  })

  return jsonResponse({
    conflicts: conflicts.map((c) => ({
      user: c.user,
      animations: c.animations.map((s) => ({
        animationId: s.animationId,
        title: s.title,
        scheduledAt: s.scheduledAt,
        plannedDurationMin: s.plannedDurationMin,
        prepTimeMin: s.prepTimeMin,
        status: s.status,
        bdmMission: s.bdmMission,
        role: s.role,
        participantStatus: s.participantStatus ?? null,
      })),
    })),
    weekStart: weekStart.toISOString(),
    weekEnd: weekEnd.toISOString(),
  })
})
