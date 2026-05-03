import { useQuery } from '@tanstack/react-query'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { Animation, AnimationParticipant, DeletionRequest, TimeCorrectionRequest } from '@/types/database'
import type { AnimationStatus } from '@/types/database'
import type { AnimationServer, Village, AnimationType } from '@/lib/schemas/animation'

export interface AnimationFilters {
  status?: AnimationStatus | AnimationStatus[]
  server?: AnimationServer
  village?: Village
  type?: AnimationType
  title?: string
  member_id?: string
  creator_id?: string
  from?: string
  to?: string
  as_participant?: boolean
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface AnimationListResult {
  animations: Animation[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export function useAnimations(filters: AnimationFilters = {}) {
  return useQuery({
    queryKey: queryKeys.animations.list(filters),
    queryFn: () => invokeEdge<AnimationListResult>('animations-list', filters),
  })
}

export interface CalendarAvailability {
  day: string
  at: string
  occupiedCount: number
  presentCount: number
  absentCount: number
  totalUsers: number
  activeAnimationCount: number
  byPole: {
    animation: { occupiedCount: number; presentCount: number }
    mj: { occupiedCount: number; presentCount: number }
  }
}

export function useCalendarAvailability(params: { day: string; from: string; to: string; at?: string }) {
  return useQuery({
    queryKey: queryKeys.calendar.availability(params.day, params.at),
    queryFn: () => invokeEdge<CalendarAvailability>('calendar-availability', params),
  })
}

export function useAnimation(id: string) {
  return useQuery({
    queryKey: queryKeys.animations.detail(id),
    queryFn: () => invokeEdge<{
      animation: Animation
      participants: AnimationParticipant[]
      deletionRequest: DeletionRequest | null
      timeCorrectionRequest: TimeCorrectionRequest | null
    }>('animations-get', { id }),
    enabled: !!id,
  })
}

export function useDeletionRequests(enabled = true) {
  return useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => invokeEdge<{ requests: DeletionRequest[] }>('deletion-requests-list'),
    enabled,
  })
}

export function useTimeCorrectionRequests(enabled = true) {
  return useQuery({
    queryKey: ['time-correction-requests'],
    queryFn: () => invokeEdge<{ requests: TimeCorrectionRequest[] }>('time-correction-requests-list'),
    enabled,
  })
}

export function useWeeklyStats(userId?: string) {
  return useQuery({
    queryKey: queryKeys.stats.weekly(userId),
    queryFn: () => invokeEdge<import('@/types/database').WeeklyStats>('stats-weekly', userId ? { user_id: userId } : {}),
  })
}

export function useMyReports() {
  return useQuery({
    queryKey: queryKeys.reports.mine,
    queryFn: () => invokeEdge<import('@/types/database').AnimationReport[]>('reports-list-mine'),
  })
}

export function usePendingReports(enabled = true) {
  return useQuery({
    queryKey: queryKeys.reports.pending,
    queryFn: () => invokeEdge<import('@/types/database').AnimationReport[]>('reports-list-pending'),
    enabled,
  })
}

export function useTeamReports(bounds: { start: Date; end: Date }) {
  const from = bounds.start.toISOString()
  const to = bounds.end.toISOString()
  return useQuery({
    queryKey: queryKeys.reports.team(from, to),
    queryFn: () =>
      invokeEdge<import('@/types/database').AnimationReport[]>('reports-list-team', {
        from,
        to,
      }),
  })
}

export function useAbsences(userId?: string) {
  return useQuery({
    queryKey: queryKeys.absences.list(userId),
    queryFn: () => invokeEdge<import('@/types/database').UserAbsence[]>('absences-list', userId ? { user_id: userId } : {}),
  })
}

export interface AbsencesSummary {
  absentCount: number
  totalStaff: number
  absentMembers: { username: string; avatar_url: string | null; role?: string | null; from_date: string; to_date: string }[]
  absentByPole?: {
    animation: { username: string; avatar_url: string | null; role?: string | null; from_date: string; to_date: string }[]
    mj: { username: string; avatar_url: string | null; role?: string | null; from_date: string; to_date: string }[]
  }
  totalByPole?: {
    animation: number
    mj: number
  }
}

export function useAbsencesSummary() {
  return useQuery({
    queryKey: ['absences', 'week-summary'] as const,
    queryFn: () => invokeEdge<AbsencesSummary>('absences-list', { week_summary: true }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useVillageStats(weekStart?: Date) {
  const weekStartIso = weekStart?.toISOString()
  return useQuery({
    queryKey: [...queryKeys.stats.villages, weekStartIso ?? 'current'],
    queryFn: () => invokeEdge<import('@/types/database').VillageStats>('stats-villages', weekStartIso ? { week_start: weekStartIso } : {}),
  })
}

export interface WeeklyReviewMember {
  id: string
  username: string
  avatar_url: string | null
  role: string
  pay_pole: 'animation' | 'mj' | null
  discord_username: string | null
  steam_id: string | null
  quota: number
  quotaMax: number
  missing: number
}

export interface WeeklyReviewWarning {
  id: string
  warning_date: string
  reason: string
  created_at: string
  user: {
    id: string
    username: string
    avatar_url: string | null
    role: string
    discord_username: string | null
    steam_id: string | null
  } | null
  creator: { id: string; username: string; avatar_url: string | null } | null
}

export interface WeeklyReviewAbsence {
  id: string
  user_id: string
  declared_by: string | null
  from_date: string
  to_date: string
  reason: string | null
  created_at: string
  user: {
    id: string
    username: string
    avatar_url: string | null
    role: string
    pay_pole: 'animation' | 'mj' | null
    discord_username: string | null
    steam_id: string | null
  } | null
  declarer: { id: string; username: string; avatar_url: string | null } | null
}

export interface WeeklyReviewDeparture {
  id: string
  username: string
  avatar_url: string | null
  role: string
  discord_username: string | null
  steam_id: string | null
  deactivated_at: string | null
  deactivation_reason: string | null
  deactivated_by_username: string | null
}

export interface WeeklyReview {
  week: { start: string; end: string; startDate: string; endDate: string }
  previousWeek: { start: string; end: string; startDate: string; endDate: string }
  hasTwoWeekHistory: boolean
  firstWeekStartDate: string
  warnings: WeeklyReviewWarning[]
  justifiedAbsencesThisWeek: WeeklyReviewAbsence[]
  departures: WeeklyReviewDeparture[]
  unjustifiedThisWeek: WeeklyReviewMember[]
  unjustifiedTwoWeeks: WeeklyReviewMember[]
  quotaMissingThisWeek: WeeklyReviewMember[]
  quotaMissingTwoWeeks: WeeklyReviewMember[]
}

export function useWeeklyReview(weekStart?: Date) {
  const weekStartIso = weekStart?.toISOString()
  return useQuery({
    queryKey: [...queryKeys.weeklyReview, weekStartIso ?? 'current'],
    queryFn: () => invokeEdge<WeeklyReview>('weekly-review', weekStartIso ? { week_start: weekStartIso } : {}),
  })
}

export function useLeaderboard(period: 'week' | 'month' | 'all', weekStart?: Date) {
  const weekStartIso = period === 'week' ? weekStart?.toISOString() : undefined
  return useQuery({
    queryKey: queryKeys.leaderboard(period, weekStartIso),
    queryFn: () => invokeEdge<import('@/types/database').LeaderboardResult>('leaderboard', {
      period,
      ...(weekStartIso ? { week_start: weekStartIso } : {}),
    }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members.list,
    queryFn: () => invokeEdge<import('@/types/database').MemberEntry[]>('members-list'),
  })
}

export function useMemberDirectory(enabled = true) {
  return useQuery({
    queryKey: queryKeys.members.directory,
    queryFn: () => invokeEdge<import('@/types/database').MemberDirectoryEntry[]>('members-directory'),
    staleTime: 5 * 60 * 1000,
    enabled,
  })
}

export interface FormerMemberEntry {
  id: string
  discordId: string
  username: string
  avatarUrl: string | null
  role: string
  deactivatedAt: string
  deactivationReason: string | null
  deactivatedByUsername: string | null
  totalAnimationsCreated: number
  totalHoursAnimated: number
  igPermsRemoved: boolean
  discordPermsRemoved: boolean
}

export function useFormerMembers() {
  return useQuery({
    queryKey: queryKeys.members.former,
    queryFn: () => invokeEdge<FormerMemberEntry[]>('members-former-list'),
  })
}

export function useUserReports(userId: string) {
  return useQuery({
    queryKey: ['reports', 'user', userId] as const,
    queryFn: () => invokeEdge<import('@/types/database').AnimationReport[]>('reports-list-user', { user_id: userId }),
    enabled: !!userId,
  })
}

export function useUserWarnings(userId: string) {
  return useQuery({
    queryKey: queryKeys.warnings.user(userId),
    queryFn: () => invokeEdge<import('@/types/database').UserWarning[]>('warnings-list', { user_id: userId }),
    enabled: !!userId,
  })
}

export interface AuditLogFilters {
  action?: string | null
  actorId?: string | null
  page?: number
  pageSize?: number
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery({
    queryKey: queryKeys.logs.list(filters),
    queryFn: () =>
      invokeEdge<import('@/types/database').AuditLogsResult>('logs-list', {
        ...(filters.action ? { action: filters.action } : {}),
        ...(filters.actorId ? { actor_id: filters.actorId } : {}),
        page: filters.page ?? 1,
        pageSize: filters.pageSize ?? 50,
      }),
  })
}

export interface WeeklyEvolutionPoint {
  weekStart: string
  label: string
  count: number
  total: number
}

export interface WeeklyEvolutionProfile {
  id: string
  username: string
  avatar_url: string | null
}

export interface WeeklyEvolutionResult {
  weeks: WeeklyEvolutionPoint[]
  profiles: WeeklyEvolutionProfile[]
}

export function useWeeklyEvolution(userId?: string | null, weeks = 12, pole?: 'anim' | 'mj' | null) {
  return useQuery({
    queryKey: ['stats', 'weekly-evolution', userId ?? null, weeks, pole ?? null] as const,
    queryFn: () =>
      invokeEdge<WeeklyEvolutionResult>('stats-weekly-evolution', {
        ...(userId ? { user_id: userId } : {}),
        ...(pole ? { pole } : {}),
        weeks,
      }),
    staleTime: 5 * 60 * 1000,
  })
}

export function usePaies(weekStart?: Date) {
  return useQuery({
    queryKey: ['paies', weekStart?.toISOString()] as const,
    queryFn: () => invokeEdge<import('@/types/database').PaiesResult>('paies', weekStart ? { week_start: weekStart.toISOString() } : {}),
  })
}

// ─── Recrutement / Formation ──────────────────────────────────────────────────

export function useSeniors() {
  return useQuery({
    queryKey: ['seniors'] as const,
    queryFn: () => invokeEdge<import('@/types/database').SeniorProfile[]>('seniors-list'),
    staleTime: 5 * 60 * 1000,
  })
}

export function useRecrutements() {
  return useQuery({
    queryKey: ['recrutements'] as const,
    queryFn: () => invokeEdge<import('@/types/database').RecrutementSession[]>('recrutement-list'),
  })
}

export function useFormations() {
  return useQuery({
    queryKey: ['formations'] as const,
    queryFn: () => invokeEdge<import('@/types/database').FormationSession[]>('formation-list'),
  })
}

export function useRecentRecruits(pole?: 'mj' | 'animation') {
  return useQuery({
    queryKey: ['recruits-recent', pole ?? null] as const,
    queryFn: () => invokeEdge<import('@/types/database').RecentRecruit[]>('recruits-recent-list', pole ? { pole } : {}),
    staleTime: 2 * 60 * 1000,
  })
}

export function useProfileHistory(profileId: string | undefined) {
  return useQuery({
    queryKey: ['profile-history', profileId] as const,
    queryFn: () => invokeEdge<import('@/types/database').ProfileHistory>('profile-history', { profile_id: profileId }),
    enabled: !!profileId,
  })
}

export function useRequetes() {
  return useQuery({
    queryKey: queryKeys.requetes.all,
    queryFn: () => invokeEdge<import('@/types/database').RequetesListResult>('requetes-list'),
  })
}

export function useTrameReports() {
  return useQuery({
    queryKey: queryKeys.trameReports.list(),
    queryFn: () => invokeEdge<import('@/types/database').TrameReport[]>('trame-reports-list'),
  })
}

export function useUserTrameReports(userId: string) {
  return useQuery({
    queryKey: queryKeys.trameReports.user(userId),
    queryFn: () => invokeEdge<import('@/types/database').TrameReport[]>('trame-reports-user', { user_id: userId }),
    enabled: !!userId,
  })
}
