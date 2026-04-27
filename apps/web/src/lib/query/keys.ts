
export const queryKeys = {
  auth: {
    me: ['auth', 'me'] as const,
  },
  animations: {
    all: ['animations'] as const,
    list: (filters?: object) => ['animations', 'list', filters] as const,
    detail: (id: string) => ['animation', id] as const,
  },
  participants: {
    forAnimation: (animationId: string) => ['participants', animationId] as const,
  },
  reports: {
    mine: ['reports', 'mine'] as const,
    pending: ['reports', 'pending'] as const,
  },
  absences: {
    list: (userId?: string) => ['absences', userId ?? 'self'] as const,
  },
  stats: {
    weekly: (userId?: string) => ['stats', 'weekly', userId ?? 'self'] as const,
    villages: ['stats', 'villages'] as const,
  },
  leaderboard: (period: string) => ['leaderboard', period] as const,
  members: {
    list: ['members'] as const,
    former: ['members', 'former'] as const,
  },
  warnings: {
    user: (userId: string) => ['warnings', userId] as const,
  },
  calendar: {
    week: (weekStart: string) => ['calendar', weekStart] as const,
  },
  messages: {
    forAnimation: (animationId: string) => ['messages', animationId] as const,
  },
  trameReports: {
    all: ['trame-reports'] as const,
    list: () => ['trame-reports', 'list'] as const,
    user: (userId: string) => ['trame-reports', 'user', userId] as const,
  },
  requetes: {
    all: ['requetes'] as const,
  },
} as const

export type QueryKeys = typeof queryKeys

export const invalidationGroups = {
  afterAnimationMutation: (id?: string) => [
    queryKeys.animations.all,
    queryKeys.animations.list(),
    queryKeys.stats.weekly(),
    ...(id ? [queryKeys.animations.detail(id)] : []),
  ],
  afterParticipantMutation: (animationId: string) => [
    queryKeys.participants.forAnimation(animationId),
    queryKeys.animations.detail(animationId),
  ],
  afterReportMutation: () => [queryKeys.reports.mine, queryKeys.reports.pending],
  afterAbsenceMutation: () => [queryKeys.absences.list()],
  afterMemberMutation: () => [queryKeys.members.list],
}
