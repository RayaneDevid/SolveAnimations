import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { CreateAnimationInput } from '@/lib/schemas/animation'
import type { Animation } from '@/types/database'

export function useCreateAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAnimationInput) =>
      invokeEdge<{ animation: Animation }>('animations-create', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.stats.weekly() })
    },
  })
}

export function useValidateAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-validate', { id }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
    },
  })
}

export function useRejectAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      invokeEdge<{ animation: Animation }>('animations-reject', { id, reason }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
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
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
    },
  })
}

export function useStartPrepAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-start-prep', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
    },
  })
}

export function useStopPrepAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-stop-prep', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
    },
  })
}

export function useStopAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-stop', { id }),
    onSuccess: (data, id) => {
      updateDetailCache(qc, id, data.animation)
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.stats.weekly() })
      qc.invalidateQueries({ queryKey: queryKeys.reports.mine })
    },
  })
}

export function useCancelAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-cancel', { id }),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
    },
  })
}

export function useDeleteAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ success: boolean }>('animations-delete', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.stats.weekly() })
    },
  })
}

export function useRequestDeletion() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (animationId: string) =>
      invokeEdge<{ request: { id: string } }>('animations-request-deletion', { animation_id: animationId }),
    onSuccess: (_, animationId) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(animationId) })
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
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
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
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
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
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
    },
  })
}

export function useApplyParticipant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ animationId }: { animationId: string }) =>
      invokeEdge<object>('participants-apply', { animation_id: animationId }),
    onSuccess: (_, { animationId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(animationId) })
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
    },
  })
}

export function useRemoveParticipant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ participantId }: { participantId: string; animationId: string }) =>
      invokeEdge<object>('participants-remove-validated', { participant_id: participantId }),
    onSuccess: (_, { animationId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(animationId) })
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
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
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(animationId) })
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
    },
  })
}

export function useSubmitReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, characterName, comments }: { reportId: string; characterName: string; comments: string }) =>
      invokeEdge<object>('reports-submit', { report_id: reportId, character_name: characterName, comments }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.reports.mine })
    },
  })
}

export function useCreateAbsence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { fromDate: string; toDate: string; reason?: string }) =>
      invokeEdge<object>('absences-create', {
        from_date: body.fromDate,
        to_date: body.toDate,
        reason: body.reason,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.absences.list() })
    },
  })
}

export function useDeleteAbsence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<object>('absences-delete', { id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.absences.list() })
    },
  })
}

export function useUpdateAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & Partial<import('@/lib/schemas/animation').CreateAnimationInput>) =>
      invokeEdge<{ animation: Animation }>('animations-update', { id, ...body }),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(id) })
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
    }) => invokeEdge<{ animation: Animation }>('animations-update', body),
    onSuccess: (data, { id }) => {
      updateDetailCache(qc, id, data.animation)
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
      qc.invalidateQueries({ queryKey: queryKeys.stats.weekly() })
    },
  })
}

export function useReactivateMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      invokeEdge<object>('members-reactivate', { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.list })
      qc.invalidateQueries({ queryKey: queryKeys.members.former })
    },
  })
}

export function useUpdateMemberPerms() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, field, value }: { userId: string; field: 'ig_perms_removed' | 'discord_perms_removed'; value: boolean }) =>
      invokeEdge<object>('members-update-perms', { user_id: userId, field, value }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.former })
    },
  })
}

export function useUpdateProfile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { steam_id?: string | null; arrival_date?: string | null; contact_email?: string | null; gender?: 'homme' | 'femme' | null }) =>
      invokeEdge<object>('profile-update', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.auth.me })
    },
  })
}

export function useRemoveMemberAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
      invokeEdge<object>('members-remove-access', { user_id: userId, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.list })
      qc.invalidateQueries({ queryKey: queryKeys.members.former })
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
