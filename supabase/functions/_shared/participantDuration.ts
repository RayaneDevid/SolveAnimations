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
 * animation duration plus prep. If they joined after the animation had already
 * started, they only count from join time, and the prep is excluded.
 *
 * Used by paies, stats, members and leaderboard to pay/count fairly.
 */
export function computeParticipantDuration(
  joinedAt: string | null,
  anim: ParticipantDurationAnimation,
): ParticipantDurationResult {
  const animDuration = anim.actual_duration_min ?? 0
  const prepDuration = anim.actual_prep_time_min ?? anim.prep_time_min ?? 0

  if (!joinedAt || !anim.started_at) {
    return {
      animMinutes: animDuration,
      prepMinutes: prepDuration,
      totalMinutes: animDuration + prepDuration,
      offsetAtJoinMin: 0,
      lateJoin: false,
    }
  }

  const startedMs = new Date(anim.started_at).getTime()
  const joinedMs = new Date(joinedAt).getTime()

  if (joinedMs <= startedMs) {
    return {
      animMinutes: animDuration,
      prepMinutes: prepDuration,
      totalMinutes: animDuration + prepDuration,
      offsetAtJoinMin: 0,
      lateJoin: false,
    }
  }

  const offsetMin = Math.floor((joinedMs - startedMs) / 60_000)
  const animMinutes = Math.max(0, animDuration - offsetMin)
  return {
    animMinutes,
    prepMinutes: 0,
    totalMinutes: animMinutes,
    offsetAtJoinMin: offsetMin,
    lateJoin: true,
  }
}
