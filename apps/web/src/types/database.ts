import type { StaffRoleKey } from '@/lib/config/discord'
import type { AnimationServer, AnimationType, BdmMissionRank, BdmMissionType, Village } from '@/lib/schemas/animation'

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
  discord_username: string | null
  avatar_url: string | null
  role: StaffRoleKey
  available_roles: StaffRoleKey[]
  primary_role_overridden: boolean
  pay_pole: 'animation' | 'mj' | null
  last_role_check_at: string
  created_at: string
  last_login_at: string
  is_active: boolean
  steam_id: string | null
  arrival_date: string | null
  gender: 'homme' | 'femme' | 'autre' | null
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
  registrations_locked: boolean
  bdm_mission: boolean
  bdm_spontaneous: boolean
  bdm_mission_rank: BdmMissionRank
  bdm_mission_type: BdmMissionType
  pole: 'animation' | 'mj' | 'les_deux'
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
  reminder_15min_sent_at: string | null
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

export interface TimeCorrectionRequest {
  id: string
  animation_id: string
  requested_by: string
  requested_at: string
  requested_started_at: string
  requested_actual_duration_min: number
  requested_actual_prep_time_min: number
  reason: string | null
  status: 'pending' | 'approved' | 'denied'
  decided_by: string | null
  decided_at: string | null
  animation?: Pick<
    Animation,
    | 'id'
    | 'title'
    | 'status'
    | 'scheduled_at'
    | 'started_at'
    | 'ended_at'
    | 'planned_duration_min'
    | 'actual_duration_min'
    | 'prep_time_min'
    | 'actual_prep_time_min'
    | 'server'
    | 'village'
    | 'type'
  >
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
  joined_at: string | null
  participation_ended_at: string | null
  user?: Profile
}

export interface AnimationReport {
  id: string
  animation_id: string
  user_id: string
  pole: 'animateur' | 'mj' | 'bdm' | string
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
  declared_by: string | null
  from_date: string
  to_date: string
  reason: string | null
  created_at: string
  declarer?: { id: string; username: string; avatar_url: string | null } | null
}

export interface UserWarning {
  id: string
  user_id: string
  created_by: string | null
  warning_date: string
  reason: string
  created_at: string
  creator?: { id: string; username: string; avatar_url: string | null } | null
}

export interface Broadcast {
  id: string
  title: string | null
  message: string
  audience: 'all' | 'selected' | 'pole_animation' | 'pole_mj' | 'pole_bdm'
  created_by: string | null
  created_at: string
  archived_at: string | null
  creator?: { id: string; username: string; avatar_url: string | null } | null
}

export interface WeeklyStats {
  animationsCreated: number
  hoursAnimated: number
  participationsValidated: number
  quota: number
  quotaMax: number | null
  pole: 'animateur' | 'mj' | 'bdm'
  availablePoles: Array<'animateur' | 'mj' | 'bdm'>
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
  quotaCompletion: {
    animation: QuotaCompletion
    mj: QuotaCompletion
  }
  lastFourWeeks: Array<{
    weekStart: string
    byVillage: Record<string, number>
    counts: Record<string, number>
  }>
}

export interface QuotaCompletion {
  filled: number
  missing: number
  absent: number
  total: number
  filledPercent: number
  missingPercent: number
  absentPercent: number
}

export interface LeaderboardEntry {
  userId: string
  username: string
  avatarUrl: string | null
  role: string
  primaryRole?: string
  gender: 'homme' | 'femme' | 'autre' | null
  hoursAnimated: number
  animationsCreated: number
  participationsValidated: number
  rank: number
}

export interface LeaderboardResult {
  byHours: LeaderboardEntry[]
  byAnimations: LeaderboardEntry[]
  byParticipations: LeaderboardEntry[]
  bdmByHours: LeaderboardEntry[]
  bdmByAnimations: LeaderboardEntry[]
  bdmByParticipations: LeaderboardEntry[]
  period: 'week' | 'month' | 'all'
}

export interface MemberEntry {
  id: string
  discordId: string
  username: string
  discordUsername: string | null
  avatarUrl: string | null
  role: StaffRoleKey
  availableRoles: StaffRoleKey[]
  payPole: 'animation' | 'mj' | null
  lastActivityAt: string | null
  lastLoginAt: string
  lastRoleCheckAt: string
  isAbsent: boolean
  absenceReason: string | null
  absenceDeclaredBy: string | null
  absenceFromDate: string | null
  absenceToDate: string | null
  warningCount: number
  steamId: string | null
  arrivalDate: string | null
  gender: 'homme' | 'femme' | 'autre' | null
  weeklyStats: {
    animationsCreated: number
    hoursAnimated: number
    participationsValidated: number
    quotaMax: number | null
  }
  weeklyTotals?: {
    animationsCreated: number
    hoursAnimated: number
  }
  totalStats: {
    animationsCreated: number
    hoursAnimated: number
  }
}

export interface MemberDirectoryEntry {
  id: string
  username: string
  avatarUrl: string | null
  role: StaffRoleKey
}

export interface PaiesEntry {
  id: string
  username: string
  avatarUrl: string | null
  discordId: string
  steamId: string | null
  role: StaffRoleKey
  payPole: 'animation' | 'mj' | 'bdm'
  payRole: 'animateur' | 'senior' | 'mj' | 'mj_senior' | 'bdm' | 'responsable_bdm'
  animationsCount: number
  createdAnimationsCount: number
  participationsCount: number
  formationsCount: number
  animationMin: number
  prepMin: number
  totalMin: number
  moyenne: number
  grande: number
  quotaMax: number | null
  quotaMin: number | null
  quotaFilled: boolean
  seniorBase: number
  timePay: number
  bdmMissionPay: number
  podiumBonus: number
  hoursPodiumBonus: number
  createdPodiumBonus: number
  participationPodiumBonus: number
  remuneration: number
  remunerationCapped: boolean
  isRemoved: boolean
}

export interface AuditLogEntry {
  id: string
  actor_id: string | null
  action: string
  target_type: string
  target_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor?: { id: string; username: string; avatar_url: string | null; role: StaffRoleKey } | null
}

export interface AuditLogsResult {
  logs: AuditLogEntry[]
  actions: string[]
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export type RequeteSubject =
  | 'grade_superieur_tkj'
  | 'demande_give'
  | 'setmodel_tenue'
  | 'reservation_secteur'
  | 'situation_problematique'
  | 'autres'

export type RequeteDestination = 'ra' | 'rmj'
export type RequeteStatus = 'pending' | 'accepted' | 'refused'

export interface Requete {
  id: string
  subject: RequeteSubject
  destination: RequeteDestination
  description: string
  creator_id: string
  status: RequeteStatus
  decided_by: string | null
  decided_at: string | null
  decision_reason: string | null
  created_at: string
  creator?: { id: string; username: string; avatar_url: string | null; role: string }
  decider?: { id: string; username: string; avatar_url: string | null } | null
}

export interface RequetesListResult {
  mine: Requete[]
  incoming: Requete[]
}

export interface TrameReport {
  id: string
  title: string
  document_url: string
  author_id: string
  created_at: string
  category: 'clan' | 'hors_clan' | 'lore' | 'bdm' | 'autre'
  writing_time_min: number | null
  validated_by: string | null
  author?: { id: string; username: string; avatar_url: string | null }
  co_authors?: Array<{ id: string; username: string; avatar_url: string | null }>
}

export interface PaiesResult {
  entries: PaiesEntry[]
  weekStart: string
  weekEnd: string
  uniqueAnimationsCount: number
  uniqueAnimationsTotalMin: number
}

export interface ParticipationConflictAnimation {
  animationId: string
  title: string
  scheduledAt: string
  plannedDurationMin: number
  prepTimeMin: number
  actualDurationMin: number | null
  actualPrepTimeMin: number | null
  startedAt: string | null
  endedAt: string | null
  slotStart: string
  slotEnd: string
  status: AnimationStatus
  pole: 'animation' | 'mj' | 'les_deux'
  bdmMission: boolean
  role: 'creator' | 'participant'
  participantId: string | null
  participantStatus: 'pending' | 'validated' | null
  participationEndedAt: string | null
}

export interface ParticipationConflictEntry {
  user: { id: string; username: string; avatarUrl: string | null; role: StaffRoleKey }
  animations: ParticipationConflictAnimation[]
}

export interface ParticipationConflictsResult {
  conflicts: ParticipationConflictEntry[]
  weekStart: string
  weekEnd: string
}

export interface AnimationMessage {
  id: string
  animation_id: string
  user_id: string
  content: string
  created_at: string
  user?: Pick<Profile, 'id' | 'username' | 'avatar_url' | 'role'>
}

// ─── Recrutement / Formation ──────────────────────────────────────────────────

export interface SeniorProfile {
  id: string
  username: string
  avatar_url: string | null
  role: string
}

export interface RecruitEntry {
  id: string
  steam_id: string
  name: string
  profile_id: string | null
  profile: { username: string; avatar_url: string | null } | null
}

export interface RecrutementSession {
  id: string
  type: 'ecrit' | 'oral'
  pole: 'mj' | 'animation'
  created_at: string
  created_by_profile: { username: string; avatar_url: string | null } | null
  recruiters: Array<{ profile: { id: string; username: string; avatar_url: string | null } | null }>
  recruits: RecruitEntry[]
}

export interface TraineeEntry {
  id: string
  steam_id: string
  name: string
  profile_id: string | null
  profile: { username: string; avatar_url: string | null } | null
}

export interface FormationSession {
  id: string
  pole: 'mj' | 'animation'
  created_at: string
  created_by_profile: { username: string; avatar_url: string | null } | null
  trainers: Array<{ profile: { id: string; username: string; avatar_url: string | null } | null }>
  trainees: TraineeEntry[]
}

export interface RecentRecruit {
  id: string
  steam_id: string
  name: string
  profile_id: string | null
  session_id: string
}

export interface ProfileHistory {
  recruitments: Array<{
    id: string
    name: string
    steam_id: string
    created_at: string
    session: {
      id: string
      type: 'ecrit' | 'oral'
      pole: 'mj' | 'animation'
      created_at: string
      recruiters: Array<{ profile: { id: string; username: string; avatar_url: string | null } | null }>
    } | null
  }>
  trainings: Array<{
    id: string
    name: string
    steam_id: string
    created_at: string
    session: {
      id: string
      pole: 'mj' | 'animation'
      created_at: string
      trainers: Array<{ profile: { id: string; username: string; avatar_url: string | null } | null }>
    } | null
  }>
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile }
      animations: { Row: Animation }
      animation_participants: { Row: AnimationParticipant }
      animation_reports: { Row: AnimationReport }
      animation_messages: { Row: AnimationMessage }
      user_absences: { Row: UserAbsence }
    }
  }
}
