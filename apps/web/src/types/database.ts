import type { StaffRoleKey } from '@/lib/config/discord'
import type { AnimationServer, AnimationType, Village } from '@/lib/schemas/animation'

export type AnimationStatus =
  | 'pending_validation'
  | 'open'
  | 'preparing'
  | 'running'
  | 'finished'
  | 'rejected'
  | 'cancelled'
  | 'postponed'

export type ParticipantStatus = 'pending' | 'validated' | 'rejected' | 'removed'

export interface Profile {
  id: string
  discord_id: string
  username: string
  avatar_url: string | null
  role: StaffRoleKey
  last_role_check_at: string
  created_at: string
  last_login_at: string
  is_active: boolean
  steam_id: string | null
  arrival_date: string | null
  contact_email: string | null
}

export interface Animation {
  id: string
  title: string
  scheduled_at: string
  planned_duration_min: number
  required_participants: number
  server: AnimationServer
  type: AnimationType
  prep_time_min: number
  village: Village
  description: string | null
  creator_id: string
  status: AnimationStatus
  validated_by: string | null
  validated_at: string | null
  rejected_by: string | null
  rejected_at: string | null
  rejection_reason: string | null
  started_at: string | null
  ended_at: string | null
  actual_duration_min: number | null
  discord_message_id: string | null
  postponed_from: string | null
  postpone_count: number
  prep_started_at: string | null
  prep_ended_at: string | null
  actual_prep_time_min: number | null
  created_at: string
  updated_at: string
  creator?: Profile
  validated_participants_count?: number
  my_participant_status?: ParticipantStatus | null
}

export interface DeletionRequest {
  id: string
  animation_id: string
  requested_by: string
  requested_at: string
  status: 'pending' | 'approved' | 'denied'
  decided_by: string | null
  decided_at: string | null
  animation?: Pick<Animation, 'id' | 'title' | 'status' | 'scheduled_at' | 'server' | 'village' | 'type'>
  requester?: Profile
}

export interface AnimationParticipant {
  id: string
  animation_id: string
  user_id: string
  character_name: string | null
  status: ParticipantStatus
  applied_at: string
  decided_at: string | null
  decided_by: string | null
  user?: Profile
}

export interface AnimationReport {
  id: string
  animation_id: string
  user_id: string
  pole: string
  character_name: string | null
  comments: string | null
  submitted_at: string | null
  created_at: string
  animation?: Animation
  user?: Profile
}

export interface UserAbsence {
  id: string
  user_id: string
  from_date: string
  to_date: string
  reason: string | null
  created_at: string
}

export interface WeeklyStats {
  animationsCreated: number
  hoursAnimated: number
  participationsValidated: number
  quota: number
  quotaMax: number | null
  weekStart: string
  weekEnd: string
}

export interface VillageStats {
  currentWeek: {
    start: string
    end: string
    byVillage: Record<string, number>
    counts: Record<string, number>
  }
  lastFourWeeks: Array<{
    weekStart: string
    byVillage: Record<string, number>
  }>
}

export interface LeaderboardEntry {
  userId: string
  username: string
  avatarUrl: string | null
  role: string
  hoursAnimated: number
  animationsCreated: number
  participationsValidated: number
  rank: number
}

export interface LeaderboardResult {
  byHours: LeaderboardEntry[]
  byAnimations: LeaderboardEntry[]
  byParticipations: LeaderboardEntry[]
  period: 'week' | 'month' | 'all'
}

export interface MemberEntry {
  id: string
  discordId: string
  username: string
  avatarUrl: string | null
  role: string
  lastLoginAt: string
  lastRoleCheckAt: string
  isAbsent: boolean
  weeklyStats: {
    animationsCreated: number
    hoursAnimated: number
    participationsValidated: number
    quotaMax: number | null
  }
  totalStats: {
    animationsCreated: number
    hoursAnimated: number
  }
}

export interface PaiesEntry {
  id: string
  username: string
  avatarUrl: string | null
  role: string
  animationsCount: number
  animationMin: number
  prepMin: number
  totalMin: number
  petite: number
  moyenne: number
  grande: number
  quotaMax: number | null
  quotaFilled: boolean
  remuneration: number
  remunerationCapped: boolean
}

export interface PaiesResult {
  entries: PaiesEntry[]
  weekStart: string
  weekEnd: string
  uniqueAnimationsCount: number
  uniqueAnimationsTotalMin: number
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile }
      animations: { Row: Animation }
      animation_participants: { Row: AnimationParticipant }
      animation_reports: { Row: AnimationReport }
      user_absences: { Row: UserAbsence }
    }
  }
}
