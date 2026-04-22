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

export function useStartAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-start', { id }),
    onSuccess: (data, id) => {
      qc.setQueryData(
        queryKeys.animations.detail(id),
        (old: { animation: Animation; participants: unknown[] } | undefined) =>
          old ? { ...old, animation: data.animation } : old,
      )
      qc.invalidateQueries({ queryKey: queryKeys.animations.all })
    },
  })
}

export function useStopAnimation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => invokeEdge<{ animation: Animation }>('animations-stop', { id }),
    onSuccess: (data, id) => {
      qc.setQueryData(
        queryKeys.animations.detail(id),
        (old: { animation: Animation; participants: unknown[] } | undefined) =>
          old ? { ...old, animation: data.animation } : old,
      )
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
    mutationFn: ({ animationId, characterName }: { animationId: string; characterName: string }) =>
      invokeEdge<object>('participants-apply', { animation_id: animationId, character_name: characterName }),
    onSuccess: (_, { animationId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.animations.detail(animationId) })
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
    },
  })
}

export function useSubmitReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ reportId, comments }: { reportId: string; comments: string }) =>
      invokeEdge<object>('reports-submit', { report_id: reportId, comments }),
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

export function useRemoveMemberAccess() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) =>
      invokeEdge<object>('members-remove-access', { user_id: userId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.members.list })
    },
  })
}
