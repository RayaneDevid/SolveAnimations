export type AnimationSlotInput = {
  scheduled_at: string
  planned_duration_min?: number | null
  prep_time_min?: number | null
  actual_duration_min?: number | null
  actual_prep_time_min?: number | null
  started_at?: string | null
  ended_at?: string | null
  prep_started_at?: string | null
  prep_ended_at?: string | null
}

/**
 * Compute the real time-slot occupied by an animation in milliseconds.
 *
 * Prefers chrono data (started_at / ended_at / prep_started_at / actual_prep_time_min /
 * actual_duration_min) over scheduled / planned values. Falls back gracefully when the
 * animation hasn't started yet.
 */
export function animationSlotBounds(anim: AnimationSlotInput): { startMs: number; endMs: number } {
  const scheduledMs = new Date(anim.scheduled_at).getTime()
  const animStartMs = anim.started_at ? new Date(anim.started_at).getTime() : scheduledMs

  const prepMin = anim.actual_prep_time_min ?? anim.prep_time_min ?? 0
  const slotStartMs = anim.prep_started_at
    ? new Date(anim.prep_started_at).getTime()
    : animStartMs - prepMin * 60_000

  let slotEndMs: number
  if (anim.ended_at) {
    slotEndMs = new Date(anim.ended_at).getTime()
  } else if (anim.started_at && anim.actual_duration_min != null) {
    slotEndMs = animStartMs + anim.actual_duration_min * 60_000
  } else {
    slotEndMs = animStartMs + (anim.planned_duration_min ?? 0) * 60_000
  }

  return { startMs: slotStartMs, endMs: slotEndMs }
}

export function participantSlotBounds(
  anim: AnimationSlotInput,
  joinedAt?: string | null,
  participationEndedAt?: string | null,
): { startMs: number; endMs: number } {
  const bounds = animationSlotBounds(anim)
  const animStartMs = anim.started_at ? new Date(anim.started_at).getTime() : new Date(anim.scheduled_at).getTime()
  const joinedMs = joinedAt ? new Date(joinedAt).getTime() : null
  const endedMs = participationEndedAt ? new Date(participationEndedAt).getTime() : null
  return {
    startMs: joinedMs && joinedMs > animStartMs ? joinedMs : bounds.startMs,
    endMs: endedMs && endedMs < bounds.endMs ? endedMs : bounds.endMs,
  }
}
