import { useQuery } from '@tanstack/react-query'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { Animation } from '@/types/database'
import type { AnimationStatus } from '@/types/database'
import type { AnimationServer, Village, AnimationType } from '@/lib/schemas/animation'

export interface AnimationFilters {
  status?: AnimationStatus
  server?: AnimationServer
  village?: Village
  type?: AnimationType
  creator_id?: string
  from?: string
  to?: string
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
    queryFn: () => invokeEdge<{ animation: Animation; participants: import('@/types/database').AnimationParticipant[] }>('animations-get', { id }),
    enabled: !!id,
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
