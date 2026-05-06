export type ParticipantDurationAnimation = {
  started_at: string | null
  ended_at?: string | null
  actual_duration_min: number | null
  prep_time_min?: number | null
  actual_prep_time_min?: number | null
}

export type ParticipantDurationResult = {
  animMinutes: number
  prepMinutes: number
  totalMinutes: number
  /** Minutes elapsed in the animation when the participant joined. 0 if joined before/at start. */
  offsetAtJoinMin: number
  /** True if the participant joined after the animation had already started (late joiner). */
  lateJoin: boolean
}

/**
 * Compute the effective duration credited to a participant.
 *
 * If the participant joined before or at the animation's start, they get the full
 * animation duration plus prep/debrief. If they joined after the animation had
 * already started, animation time only counts from join time, but the debrief
 * bucket is still counted because actual_prep_time_min is used for prep/debrief.
 *
 * Used by paies, stats, members and leaderboard to pay/count fairly.
 */
export function computeParticipantDuration(
  joinedAt: string | null,
  anim: ParticipantDurationAnimation,
  participationEndedAt?: string | null,
): ParticipantDurationResult {
  const animDuration = anim.actual_duration_min ?? 0
  const prepDuration = anim.actual_prep_time_min ?? anim.prep_time_min ?? 0

  if (!anim.started_at) {
    return {
      animMinutes: animDuration,
      prepMinutes: prepDuration,
      totalMinutes: animDuration + prepDuration,
      offsetAtJoinMin: 0,
      lateJoin: false,
    }
  }

  const startedMs = new Date(anim.started_at).getTime()
  const joinedMs = joinedAt ? new Date(joinedAt).getTime() : startedMs
  const endedMs = participationEndedAt ? new Date(participationEndedAt).getTime() : null
  const participantEndOffsetMin = endedMs && endedMs > startedMs
    ? Math.floor((endedMs - startedMs) / 60_000)
    : animDuration
  const effectiveEndMin = Math.min(animDuration, participantEndOffsetMin)

  if (joinedMs <= startedMs) {
    const animMinutes = Math.max(0, effectiveEndMin)
    return {
      animMinutes,
      prepMinutes: prepDuration,
      totalMinutes: animMinutes + prepDuration,
      offsetAtJoinMin: 0,
      lateJoin: false,
    }
  }

  const offsetMin = Math.floor((joinedMs - startedMs) / 60_000)
  const animMinutes = Math.max(0, effectiveEndMin - offsetMin)
  return {
    animMinutes,
    prepMinutes: prepDuration,
    totalMinutes: animMinutes + prepDuration,
    offsetAtJoinMin: offsetMin,
    lateJoin: true,
  }
}
