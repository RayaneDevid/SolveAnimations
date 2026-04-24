import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { invokeEdge } from '@/lib/supabase/edge'
import { queryKeys } from '@/lib/query/keys'
import type { AnimationMessage } from '@/types/database'

export function useAnimationMessages(animationId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`chat:${animationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'animation_messages' },
        (payload) => {
          const newMsg = payload.new as AnimationMessage
          if (newMsg.animation_id !== animationId) return

          // Append instantly from the WAL payload so the message appears immediately
          qc.setQueryData(
            queryKeys.messages.forAnimation(animationId),
            (old: AnimationMessage[] | undefined) => {
              if (!old) return [newMsg]
              if (old.some((m) => m.id === newMsg.id)) return old
              return [...old, newMsg]
            },
          )
          // Background refetch to fill in the joined user profile
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
    refetchInterval: 10_000,
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
