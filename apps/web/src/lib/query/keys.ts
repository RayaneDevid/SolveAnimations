
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
    team: (from: string, to: string) => ['reports', 'team', from, to] as const,
  },
  absences: {
    list: (userId?: string) => ['absences', userId ?? 'self'] as const,
  },
  stats: {
    weekly: (userId?: string) => ['stats', 'weekly', userId ?? 'self'] as const,
    villages: ['stats', 'villages'] as const,
  },
  leaderboard: (period: string, weekStart?: string) => ['leaderboard', period, weekStart ?? 'current'] as const,
  weeklyReview: ['weekly-review'] as const,
  members: {
    list: ['members'] as const,
    directory: ['members', 'directory'] as const,
    former: ['members', 'former'] as const,
  },
  warnings: {
    user: (userId: string) => ['warnings', userId] as const,
  },
  logs: {
    list: (filters?: object) => ['logs', filters] as const,
  },
  calendar: {
    week: (weekStart: string) => ['calendar', weekStart] as const,
    availabilityAll: ['calendar', 'availability'] as const,
    availability: (day?: string, at?: string) => ['calendar', 'availability', day ?? 'current', at ?? 'now'] as const,
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
    ['animation'] as const,
    ['stats'] as const,
    ['leaderboard'] as const,
    ['paies'] as const,
    queryKeys.members.list,
    ...(id ? [queryKeys.animations.detail(id)] : []),
  ],
  afterParticipantMutation: (animationId: string) => [
    queryKeys.animations.all,
    ['stats'] as const,
    ['leaderboard'] as const,
    ['paies'] as const,
    ['reports'] as const,
    queryKeys.members.list,
    queryKeys.animations.detail(animationId),
  ],
  afterReportMutation: () => [['reports'] as const],
  afterAbsenceMutation: () => [['absences'] as const, queryKeys.members.list],
  afterMemberMutation: () => [
    queryKeys.members.list,
    queryKeys.members.former,
    ['stats'] as const,
    ['leaderboard'] as const,
    ['paies'] as const,
  ],
}
