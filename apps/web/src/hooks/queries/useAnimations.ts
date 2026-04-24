import { useQuery } from '@tanstack/react-query'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { Animation, AnimationParticipant, DeletionRequest } from '@/types/database'
import type { AnimationStatus } from '@/types/database'
import type { AnimationServer, Village, AnimationType } from '@/lib/schemas/animation'

export interface AnimationFilters {
  status?: AnimationStatus | AnimationStatus[]
  server?: AnimationServer
  village?: Village
  type?: AnimationType
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
}

export function useAnimations(filters: AnimationFilters = {}) {
  return useQuery({
    queryKey: queryKeys.animations.list(filters),
    queryFn: () => invokeEdge<AnimationListResult>('animations-list', filters),
  })
}

export function useAnimation(id: string) {
  return useQuery({
    queryKey: queryKeys.animations.detail(id),
    queryFn: () => invokeEdge<{ animation: Animation; participants: AnimationParticipant[]; deletionRequest: DeletionRequest | null }>('animations-get', { id }),
    enabled: !!id,
  })
}

export function useDeletionRequests() {
  return useQuery({
    queryKey: ['deletion-requests'],
    queryFn: () => invokeEdge<{ requests: DeletionRequest[] }>('deletion-requests-list'),
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

export function useAbsences(userId?: string) {
  return useQuery({
    queryKey: queryKeys.absences.list(userId),
    queryFn: () => invokeEdge<import('@/types/database').UserAbsence[]>('absences-list', userId ? { user_id: userId } : {}),
  })
}

export function useVillageStats() {
  return useQuery({
    queryKey: queryKeys.stats.villages,
    queryFn: () => invokeEdge<import('@/types/database').VillageStats>('stats-villages'),
  })
}

export function useLeaderboard(period: 'week' | 'month' | 'all') {
  return useQuery({
    queryKey: queryKeys.leaderboard(period),
    queryFn: () => invokeEdge<import('@/types/database').LeaderboardResult>('leaderboard', { period }),
    staleTime: 5 * 60 * 1000,
  })
}

export function useMembers() {
  return useQuery({
    queryKey: queryKeys.members.list,
    queryFn: () => invokeEdge<import('@/types/database').MemberEntry[]>('members-list'),
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

export function usePaies(weekStart?: Date) {
  return useQuery({
    queryKey: ['paies', weekStart?.toISOString()] as const,
    queryFn: () => invokeEdge<import('@/types/database').PaiesResult>('paies', weekStart ? { week_start: weekStart.toISOString() } : {}),
  })
}
