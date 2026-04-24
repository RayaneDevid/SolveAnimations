import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { AnimationMessage } from '@/types/database'

export function useAnimationMessages(animationId: string) {
  const qc = useQueryClient()

  // Realtime: append new messages directly to cache without refetch
  useEffect(() => {
    const channel = supabase
      .channel(`chat:${animationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'animation_messages',
          filter: `animation_id=eq.${animationId}`,
        },
        () => {
          // Refetch to get the full message with joined user profile
          qc.invalidateQueries({ queryKey: queryKeys.messages.forAnimation(animationId) })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [animationId, qc])

  return useQuery({
    queryKey: queryKeys.messages.forAnimation(animationId),
    queryFn: () =>
      invokeEdge<{ messages: AnimationMessage[] }>('messages-list', { animation_id: animationId }).then(
        (r) => r.messages,
      ),
    staleTime: 0,
  })
}

export function useSendMessage(animationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) =>
      invokeEdge<{ message: AnimationMessage }>('messages-send', {
        animation_id: animationId,
        content,
      }),
    onSuccess: ({ message }) => {
      // Optimistically append to cache so sender sees it immediately
      qc.setQueryData(
        queryKeys.messages.forAnimation(animationId),
        (old: AnimationMessage[] | undefined) => {
          if (!old) return [message]
          const exists = old.some((m) => m.id === message.id)
          return exists ? old : [...old, message]
        },
      )
    },
  })
}
