import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { CreateAnimationInput } from '@/lib/schemas/animation'
import type { Animation } from '@/types/database'

const invalidateAnimationCaches = (qc: QueryClient, id?: string) => {
  qc.invalidateQueries({ queryKey: queryKeys.animations.all })
  qc.invalidateQueries({ queryKey: ['animation'] })
  if (id) qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
}

const invalidateStatsCaches = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ['stats'] })
  qc.invalidateQueries({ queryKey: ['leaderboard'] })
  qc.invalidateQueries({ queryKey: ['paies'] })
}

const invalidateReportCaches = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ['reports'] })
}

const invalidateMemberCaches = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: queryKeys.members.list })
  qc.invalidateQueries({ queryKey: queryKeys.members.former })
}

const invalidateAbsenceCaches = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: ['absences'] })
  invalidateMemberCaches(qc)
}

const invalidateProfileCaches = (qc: QueryClient) => {
  qc.invalidateQueries({ queryKey: queryKeys.auth.me })
  qc.invalidateQueries({ queryKey: ['profile-history'] })
  invalidateMemberCaches(qc)
}

export function useCreateAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAnimationInput) =>
      invokeEdge<{ animation: Animation }>('animations-create', body),
    onSuccess: () => {
      invalidateAnimationCaches(qc)
      invalidateStatsCaches(qc)
      invalidateReportCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}

export function useValidateAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-validate', { id }),
    onSuccess: (_, id) => {
      invalidateAnimationCaches(qc, id)
    },
  })
}

export function useRejectAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invokeEdge<{ animation: Animation }>('animations-reject', { id, reason }),
    onSuccess: (_, { id }) => {
      invalidateAnimationCaches(qc, id)
    },
  })
}

const updateDetailCache = (
  qc: ReturnType<typeof useQueryClient>,
  id: string,
  animation: Animation,
) => {
  qc.setQueryData(
    queryKeys.animations.detail(id),
    (old: { animation: Animation; participants: unknown[] } | undefined) =>
      old ? { ...old, animation } : old,
  )
  // Force refetch in case setQueryData doesn't trigger re-render
  qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
}

export function useStartAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-start', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      invalidateAnimationCaches(qc, id)
    },
  })
}

export function useStartPrepAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-start-prep', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      invalidateAnimationCaches(qc, id)
    },
  })
}

export function useStopPrepAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-stop-prep', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      invalidateAnimationCaches(qc, id)
    },
  })
}

export function useStopAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-stop', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      invalidateAnimationCaches(qc, id)
      invalidateStatsCaches(qc)
      invalidateReportCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}

export function useCancelAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-cancel', { id }),
    onSuccess: (_, id) => {
      invalidateAnimationCaches(qc, id)
    },
  })
}

export function useDeleteAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ success: boolean }>('animations-delete', { id }),
    onSuccess: () => {
      invalidateAnimationCaches(qc)
      invalidateStatsCaches(qc)
      invalidateReportCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}

export function useRequestDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (animationId: string) =>
      invokeEdge<{ request: { id: string } }>('animations-request-deletion', { animation_id: animationId }),
    onSuccess: (_, animationId) => {
      invalidateAnimationCaches(qc, animationId)
      qc.invalidateQueries({ queryKey: ['deletion-requests'] })
    },
  })
}

export function useApproveDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      invokeEdge<{ success: boolean }>('animations-approve-deletion', { request_id: requestId }),
    onSuccess: () => {
      invalidateAnimationCaches(qc)
      invalidateStatsCaches(qc)
      invalidateReportCaches(qc)
      invalidateMemberCaches(qc)
      qc.invalidateQueries({ queryKey: ['deletion-requests'] })
    },
  })
}

export function useDenyDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (requestId: string) =>
      invokeEdge<{ success: boolean }>('animations-deny-deletion', { request_id: requestId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['deletion-requests'] })
      invalidateAnimationCaches(qc)
    },
  })
}

export function usePostponeAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, newScheduledAt }: { id: string; newScheduledAt: Date }) =>
      invokeEdge<{ animation: Animation }>('animations-postpone', {
        id,
        new_scheduled_at: newScheduledAt.toISOString(),
      }),
    onSuccess: (_, { id }) => {
      invalidateAnimationCaches(qc, id)
    },
  })
}

export function useApplyParticipant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ animationId }: { animationId: string }) =>
      invokeEdge<object>('participants-apply', { animation_id: animationId }),
    onSuccess: (_, { animationId }) => {
      invalidateAnimationCaches(qc, animationId)
    },
  })
}

export function useRemoveParticipant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ participantId }: { participantId: string; animationId: string }) =>
      invokeEdge<object>('participants-remove-validated', { participant_id: participantId }),
    onSuccess: (_, { animationId }) => {
      invalidateAnimationCaches(qc, animationId)
      invalidateStatsCaches(qc)
      invalidateReportCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}

export function useDecideParticipant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      participantId,
      decision,
    }: {
      participantId: string
      decision: 'validated' | 'rejected'
      animationId: string
    }) =>
      invokeEdge<object>('participants-decide', {
        participant_id: participantId,
        decision,
      }),
    onSuccess: (_, { animationId }) => {
      invalidateAnimationCaches(qc, animationId)
    },
  })
}

export function useSubmitReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, characterName, comments }: { reportId: string; characterName: string; comments: string }) =>
      invokeEdge<object>('reports-submit', { report_id: reportId, character_name: characterName, comments }),
    onSuccess: () => {
      invalidateReportCaches(qc)
    },
  })
}

export function useCreateAbsence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { fromDate: string; toDate: string; reason?: string; userId?: string }) =>
      invokeEdge<object>('absences-create', {
        from_date: body.fromDate,
        to_date: body.toDate,
        reason: body.reason,
        ...(body.userId ? { user_id: body.userId } : {}),
      }),
    onSuccess: () => {
      invalidateAbsenceCaches(qc)
    },
  })
}

export function useDeleteAbsence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<object>('absences-delete', { id }),
    onSuccess: () => {
      invalidateAbsenceCaches(qc)
    },
  })
}

export function useUpdateAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<import('@/lib/schemas/animation').CreateAnimationInput>) =>
      invokeEdge<{ animation: Animation }>('animations-update', {
        id,
        ...(body.title !== undefined ? { title: body.title } : {}),
        ...(body.scheduledAt !== undefined ? { scheduled_at: body.scheduledAt.toISOString() } : {}),
        ...(body.plannedDurationMin !== undefined ? { planned_duration_min: body.plannedDurationMin } : {}),
        ...(body.requiredParticipants !== undefined ? { required_participants: body.requiredParticipants } : {}),
        ...(body.server !== undefined ? { server: body.server } : {}),
        ...(body.type !== undefined ? { type: body.type } : {}),
        ...(body.prepTimeMin !== undefined ? { prep_time_min: body.prepTimeMin } : {}),
        ...(body.village !== undefined ? { village: body.village } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
      }),
    onSuccess: (_, { id }) => {
      invalidateAnimationCaches(qc, id)
      invalidateStatsCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}

export function useCorrectFinishedAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      id: string
      actual_duration_min?: number
      actual_prep_time_min?: number | null
      village?: string
      server?: string
      type?: string
      scheduled_at?: string
    }) => invokeEdge<{ animation: Animation }>('animations-update', body),
    onSuccess: (data, { id }) => {
      updateDetailCache(qc, id, data.animation)
      invalidateAnimationCaches(qc, id)
      invalidateStatsCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}

export function useReactivateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      invokeEdge<object>('members-reactivate', { user_id: userId }),
    onSuccess: () => {
      invalidateMemberCaches(qc)
      invalidateStatsCaches(qc)
      qc.invalidateQueries({ queryKey: ['seniors'] })
    },
  })
}

export function useUpdateMemberPerms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, field, value }: { userId: string; field: 'ig_perms_removed' | 'discord_perms_removed'; value: boolean }) =>
      invokeEdge<object>('members-update-perms', { user_id: userId, field, value }),
    onSuccess: () => {
      invalidateMemberCaches(qc)
    },
  })
}

export function useCreateWarning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { userId: string; warningDate: string; reason: string }) =>
      invokeEdge<{ warning: import('@/types/database').UserWarning }>('warnings-create', {
        user_id: body.userId,
        warning_date: body.warningDate,
        reason: body.reason,
      }),
    onSuccess: (_, { userId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.warnings.user(userId) })
      qc.invalidateQueries({ queryKey: ['warnings'] })
      invalidateMemberCaches(qc)
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { steam_id?: string | null; arrival_date?: string | null; gender?: 'homme' | 'femme' | 'autre' | null }) =>
      invokeEdge<object>('profile-update', body),
    onSuccess: () => {
      invalidateProfileCaches(qc)
    },
  })
}

export function useRemoveMemberAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      invokeEdge<object>('members-remove-access', { user_id: userId, reason }),
    onSuccess: () => {
      invalidateMemberCaches(qc)
      invalidateStatsCaches(qc)
      qc.invalidateQueries({ queryKey: ['seniors'] })
    },
  })
}

// ─── Recrutement / Formation ──────────────────────────────────────────────────

export interface RecrutementInput {
  type: 'ecrit' | 'oral'
  pole: 'mj' | 'animation'
  recruiter_ids: string[]
  recruits: { steam_id: string; name: string }[]
}

export function useCreateRecrutement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RecrutementInput) => invokeEdge<{ id: string }>('recrutement-create', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['recrutements'] })
      qc.invalidateQueries({ queryKey: ['recruits-recent'] })
    },
  })
}

export interface FormationInput {
  pole: 'mj' | 'animation'
  trainer_ids: string[]
  trainees: { steam_id: string; name: string }[]
}

export function useCreateFormation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: FormationInput) => invokeEdge<{ id: string }>('formation-create', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['formations'] })
    },
  })
}

// ─── Requêtes ─────────────────────────────────────────────────────────────────

export function useCreateRequete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { subject: string; destination: string; description: string }) =>
      invokeEdge<{ requete: import('@/types/database').Requete }>('requetes-create', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requetes'] })
    },
  })
}

export function useDecideRequete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, reason }: { id: string; decision: 'accepted' | 'refused'; reason?: string }) =>
      invokeEdge<{ requete: import('@/types/database').Requete }>('requetes-decide', { id, decision, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['requetes'] })
    },
  })
}

// ─── Rapports trames ──────────────────────────────────────────────────────────

export function useCreateTrameReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { title: string; documentUrl: string; category: string; coAuthorIds: string[]; writingTimeMin: number; validatedBy: string }) =>
      invokeEdge<{ report: import('@/types/database').TrameReport }>('trame-reports-create', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trame-reports'] })
      invalidateMemberCaches(qc)
    },
  })
}

export function useUpdateTrameReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { id: string; title: string; documentUrl: string; category: string; coAuthorIds: string[]; writingTimeMin: number; validatedBy: string }) =>
      invokeEdge<{ report: import('@/types/database').TrameReport }>('trame-reports-update', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trame-reports'] })
      invalidateMemberCaches(qc)
    },
  })
}

export function useDeleteTrameReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ success: boolean }>('trame-reports-delete', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['trame-reports'] })
      invalidateMemberCaches(qc)
    },
  })
}

export function useAddParticipantToFinished() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ animationId, userIds }: { animationId: string; userIds: string[] }) =>
      invokeEdge<{ success: boolean; added: number }>('participants-add-to-finished', { animationId, userIds }),
    onSuccess: (_data, { animationId }) => {
      invalidateAnimationCaches(qc, animationId)
      invalidateStatsCaches(qc)
      invalidateReportCaches(qc)
      invalidateMemberCaches(qc)
    },
  })
}
