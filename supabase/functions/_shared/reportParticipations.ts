// deno-lint-ignore no-explicit-any
export async function attachReportParticipations(db: any, reports: any[]) {
  if (reports.length === 0) return reports

  const animationIds = Array.from(new Set(reports.map((report) => report.animation_id).filter(Boolean)))
  const userIds = Array.from(new Set(reports.map((report) => report.user_id).filter(Boolean)))
  if (animationIds.length === 0 || userIds.length === 0) return reports

  const { data: participations } = await db
    .from('animation_participants')
    .select('animation_id, user_id, joined_at, participation_ended_at, status')
    .in('animation_id', animationIds)
    .in('user_id', userIds)

  const byReport = new Map(
    (participations ?? []).map((participation: {
      animation_id: string
      user_id: string
      joined_at: string | null
      participation_ended_at: string | null
      status: string
    }) => [`${participation.animation_id}:${participation.user_id}`, participation]),
  )

  return reports.map((report) => ({
    ...report,
    participation: byReport.get(`${report.animation_id}:${report.user_id}`) ?? null,
  }))
}

