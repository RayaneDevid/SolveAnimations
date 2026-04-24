import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { queryKeys } from '@/lib/query/keys'

export function useRealtimeSync() {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel('global-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animations' },
        (payload) => {
          const record = (payload.new ?? payload.old) as { id?: string } | null
          qc.invalidateQueries({ queryKey: queryKeys.animations.all })
          qc.invalidateQueries({ queryKey: queryKeys.stats.weekly() })
          if (record?.id) {
            qc.invalidateQueries({ queryKey: queryKeys.animations.detail(record.id) })
          }
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'animation_participants' },
        (payload) => {
          const record = (payload.new ?? payload.old) as { animation_id?: string } | null
          if (record?.animation_id) {
            qc.invalidateQueries({ queryKey: queryKeys.animations.detail(record.animation_id) })
            qc.invalidateQueries({ queryKey: queryKeys.animations.all })
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [qc])
}
